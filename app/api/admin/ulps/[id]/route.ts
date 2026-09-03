import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peranPengelola } from '@/lib/otorisasi'

export const dynamic = 'force-dynamic'

/**
 * Apakah ULP ini berada dalam wewenang si pemanggil.
 *
 * Versi lama membandingkan langsung dengan profile.up3_id, sehingga
 * super_admin — yang memang tidak punya UP3 — selalu ditolak dengan
 * "Akun admin belum terhubung ke UP3" bahkan untuk sekadar mengedit nama ULP.
 */
async function bolehSentuhUlp(
  admin: ReturnType<typeof createAdminClient>,
  profile: { role: string; up3_id: string | null; uiw_id: string | null },
  ulpId: string,
): Promise<boolean> {
  if (profile.role === 'super_admin') {
    const { data } = await admin.from('ulp').select('id').eq('id', ulpId).maybeSingle()
    return !!data
  }

  if (profile.role === 'uiw' && profile.uiw_id) {
    const { data: up3s } = await admin.from('up3').select('id').eq('uiw_id', profile.uiw_id)
    const ids = (up3s ?? []).map((u) => u.id as string)
    if (ids.length === 0) return false
    const { data } = await admin.from('ulp').select('id').eq('id', ulpId).in('up3_id', ids).maybeSingle()
    return !!data
  }

  if (!profile.up3_id) return false
  const { data } = await admin
    .from('ulp').select('id').eq('id', ulpId).eq('up3_id', profile.up3_id).maybeSingle()
  return !!data
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { id } = await params
  const admin = createAdminClient()

  if (!(await bolehSentuhUlp(admin, profile, id))) {
    return NextResponse.json({ error: 'ULP tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { nama, kode, up3_id } = body

    if (!nama?.trim() || !kode?.trim()) {
      return NextResponse.json({ error: 'Nama dan kode ULP wajib diisi' }, { status: 400 })
    }

    const ubah: Record<string, string> = {
      nama: nama.trim(),
      kode: kode.trim().toUpperCase(),
    }

    // Memindahkan ULP ke UP3 lain. Wewenang diperiksa di DUA sisi: ULP asalnya
    // sudah lewat bolehSentuhUlp di atas, dan UP3 tujuannya diperiksa di sini —
    // tanpa itu, admin UIW bisa memindahkan ULP ke wilayah lain.
    if (up3_id && up3_id !== '') {
      if (profile.role === 'up3' || profile.role === 'admin') {
        return NextResponse.json(
          { error: 'Anda tidak berwenang memindahkan ULP ke UP3 lain' },
          { status: 403 },
        )
      }
      if (profile.role === 'uiw') {
        const { data: sah } = await admin.from('up3').select('id')
          .eq('id', up3_id).eq('uiw_id', profile.uiw_id ?? '').maybeSingle()
        if (!sah) {
          return NextResponse.json({ error: 'UP3 tujuan di luar wilayah Anda' }, { status: 403 })
        }
      }
      ubah.up3_id = up3_id
    }

    const { data, error } = await admin
      .from('ulp')
      .update(ubah)
      .eq('id', id)
      // up3_id dan join-nya WAJIB ikut: klien memakai hasil ini untuk
      // menggantikan baris di daftarnya. Tanpa keduanya, ULP yang baru
      // disimpan kehilangan induknya dan lompat ke kelompok "Tanpa UP3".
      .select('id, nama, kode, up3_id, created_at, up3:up3_id(nama, kode)')
      .single()

    if (error) {
      const msg = error.message.includes('unique') ? `Kode ULP "${kode.trim().toUpperCase()}" sudah digunakan` : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { id } = await params
  const admin = createAdminClient()

  if (!(await bolehSentuhUlp(admin, profile, id))) {
    return NextResponse.json({ error: 'ULP tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  // Cek apakah ULP masih punya data yang bergantung padanya
  const [{ count: reguCount }, { count: laporanCount }] = await Promise.all([
    admin.from('regu').select('id', { count: 'exact', head: true }).eq('ulp_id', id),
    admin.from('laporan').select('id', { count: 'exact', head: true }).eq('ulp_id', id),
  ])

  if ((reguCount ?? 0) > 0) {
    return NextResponse.json({ error: 'ULP tidak bisa dihapus karena masih memiliki data Regu' }, { status: 400 })
  }
  if ((laporanCount ?? 0) > 0) {
    return NextResponse.json({ error: 'ULP tidak bisa dihapus karena masih memiliki data Laporan' }, { status: 400 })
  }

  try {
    // Hapus relasi user_ulp dulu
    await admin.from('user_ulp').delete().eq('ulp_id', id)

    const { error } = await admin.from('ulp').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: { success: true } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
