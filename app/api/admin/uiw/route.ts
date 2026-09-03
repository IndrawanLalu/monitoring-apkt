import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ringkasGalat } from '@/lib/log'

export const dynamic = 'force-dynamic'

/**
 * Pengelolaan UIW — tingkat tertinggi hierarki.
 *
 * Hanya super_admin yang boleh menulis. Peran lain boleh MEMBACA daftarnya,
 * karena dipakai dropdown saat membuat UP3 atau akun Admin UIW.
 */
export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  let q = admin.from('uiw').select('id, nama, kode, created_at').order('nama')

  // Admin UIW hanya perlu melihat wilayahnya sendiri.
  if (profile.role === 'uiw' && profile.uiw_id) q = q.eq('id', profile.uiw_id)
  else if (profile.role !== 'super_admin') return NextResponse.json({ data: [] })

  const { data, error } = await q
  if (error) {
    console.error('[uiw GET]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal memuat daftar UIW' }, { status: 500 })
  }

  const { data: up3s } = await admin.from('up3').select('uiw_id')
  const hitung = new Map<string, number>()
  for (const u of up3s ?? []) {
    const k = u.uiw_id as string | null
    if (k) hitung.set(k, (hitung.get(k) ?? 0) + 1)
  }

  return NextResponse.json({
    data: (data ?? []).map((u) => ({ ...u, jumlahUp3: hitung.get(u.id as string) ?? 0 })),
  })
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Hanya Super Admin yang dapat menambah UIW' }, { status: 403 })
  }

  try {
    const { nama, kode } = await req.json()
    if (!nama?.trim() || !kode?.trim()) {
      return NextResponse.json({ error: 'Nama dan kode UIW wajib diisi' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('uiw')
      .insert({ nama: nama.trim(), kode: kode.trim().toUpperCase() })
      .select('id, nama, kode, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Kode UIW "${kode}" sudah dipakai` }, { status: 409 })
      }
      console.error('[uiw POST]', ringkasGalat(error))
      return NextResponse.json({ error: 'Gagal membuat UIW' }, { status: 500 })
    }

    return NextResponse.json({ data: { ...data, jumlahUp3: 0 } }, { status: 201 })
  } catch (e) {
    console.error('[uiw POST]', ringkasGalat(e))
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }
}
