import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UlpInfo {
  id: string
  nama: string
  kode: string
  wa_grup_id: string | null
  /** Induk UP3 — dipakai UI untuk mengelompokkan daftar ULP yang panjang. */
  up3_id?: string | null
  up3?: { nama: string; kode: string } | null
}

export interface UserProfile {
  id: string
  nama: string
  role: string
  up3_id: string | null
  uiw_id: string | null
  ulps: UlpInfo[]
  activeUlp: UlpInfo | null
  /**
   * Label lingkup akun untuk header — "UIW NTB", "UP3 Mataram", "Semua Unit".
   *
   * Header dulu mendaftar seluruh nama ULP (`ulps.map(nama).join(' & ')`).
   * Untuk operator dengan 2 ULP itu pas, tapi akun up3 punya 4 ULP dan akun
   * uiw punya 16 — headernya jadi sederet nama yang mendorong menu keluar
   * layar. Yang relevan bagi peran pengelola bukan daftar isinya, melainkan
   * nama lingkupnya sendiri.
   */
  lingkup: string
}

export const getProfile = cache(async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Satu query profiles (nama, role, up3_id) — kolom up3_id sudah ada pasca-migration.
  const [{ data: profile }, { data: userUlps }] = await Promise.all([
    admin.from('profiles').select('nama, role, up3_id, uiw_id').eq('id', user.id).single(),
    admin
      .from('user_ulp')
      .select('ulp:ulp(id, nama, kode, wa_grup_id, up3_id, up3:up3_id(nama, kode))')
      .eq('user_id', user.id),
  ])

  if (!profile) return null

  const up3Id = (profile as any).up3_id ?? null
  const uiwId = (profile as any).uiw_id ?? null
  const role = profile.role as string

  // `ulps` = ULP yang boleh diakses akun ini, DITENTUKAN OLEH PERANNYA.
  //
  // Diselesaikan di sini, bukan di tiap halaman, karena hampir semua halaman
  // membacanya. Sebelumnya isinya selalu dari user_ulp saja — akibatnya
  // super_admin, yang memang tidak punya baris user_ulp, mendapat daftar
  // kosong dan Settings, dashboard, piket, serta callback semuanya gagal
  // terbuka meski login berhasil.
  //
  // Untuk peran pengelola, hierarki bersifat menentukan: baris user_ulp
  // warisan tidak ikut menambah, supaya batas UP3 tidak bisa ditembus.
  // user_ulp tetap jadi mekanisme penugasan untuk operator.
  const kolomUlp = 'id, nama, kode, wa_grup_id, up3_id, up3:up3_id(nama, kode)'
  let ulps: UlpInfo[] = []
  let namaUiw: string | null = null

  if (role === 'super_admin') {
    const { data } = await admin.from('ulp').select(kolomUlp).order('nama')
    ulps = (data ?? []) as unknown as UlpInfo[]
  } else if (role === 'uiw' && uiwId) {
    const [{ data: up3s }, { data: uiwRow }] = await Promise.all([
      admin.from('up3').select('id').eq('uiw_id', uiwId),
      admin.from('uiw').select('nama').eq('id', uiwId).maybeSingle(),
    ])
    namaUiw = (uiwRow?.nama as string | undefined) ?? null
    const up3Ids = (up3s ?? []).map((u) => u.id as string)
    if (up3Ids.length > 0) {
      const { data } = await admin.from('ulp').select(kolomUlp).in('up3_id', up3Ids).order('nama')
      ulps = (data ?? []) as unknown as UlpInfo[]
    }
  } else if ((role === 'up3' || role === 'admin') && up3Id) {
    const { data } = await admin.from('ulp').select(kolomUlp).eq('up3_id', up3Id).order('nama')
    ulps = (data ?? []) as unknown as UlpInfo[]
  }

  // Operator, atau peran pengelola yang kolom hierarkinya belum terisi:
  // jatuh ke ULP yang di-assign, supaya tidak kehilangan akses mendadak.
  if (ulps.length === 0) {
    ulps = (userUlps ?? []).map((row) => row.ulp as unknown as UlpInfo).filter(Boolean)
  }

  // Nama UP3 diambil dari ULP mana pun: untuk peran up3 semuanya se-UP3.
  // Operator tetap memakai nama ULP-nya sendiri — biasanya hanya 1-2 dan
  // itulah identitas yang dikenalinya.
  const lingkup =
    role === 'super_admin'
      ? 'Semua Unit'
      : role === 'uiw'
        ? namaUiw ?? 'Unit Induk Wilayah'
        : role === 'up3' || role === 'admin'
          ? ulps[0]?.up3?.nama ?? 'Unit Pelaksana'
          : ulps.map((u) => u.nama).join(' & ') || 'Tanpa ULP'

  const cookieStore = await cookies()
  const activeUlpId = cookieStore.get('active_ulp_id')?.value
  const activeUlp = ulps.find((u) => u.id === activeUlpId) ?? ulps[0] ?? null

  return {
    id: user.id,
    nama: profile.nama,
    role: profile.role,
    up3_id: up3Id,
    uiw_id: uiwId,
    ulps,
    activeUlp,
    lingkup,
  }
})
