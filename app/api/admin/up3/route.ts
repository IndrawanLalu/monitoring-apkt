import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Pengelolaan UP3.
 *
 * Sebelumnya tidak ada API maupun UI sama sekali — dua UP3 yang ada dibuat
 * lewat SQL manual. Kini super_admin dan uiw bisa mengelolanya dari UI,
 * sehingga IT PLN tidak perlu membuka kode untuk menambah unit baru.
 *
 * Cakupan: super_admin melihat semua UP3; uiw hanya UP3 di wilayahnya.
 * Peran up3 dan operator tidak berwenang sama sekali di sini.
 */
function bolehKelolaUp3(role: string): boolean {
  return role === 'super_admin' || role === 'uiw'
}

export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  let q = admin.from('up3').select('id, nama, kode, uiw_id, created_at').order('nama')

  // Daftar ini juga dipakai dropdown saat membuat akun Admin UP3, jadi peran
  // 'up3' boleh MEMBACA — dibatasi UP3-nya sendiri.
  if (profile.role === 'uiw' && profile.uiw_id) q = q.eq('uiw_id', profile.uiw_id)
  else if (profile.role === 'up3' && profile.up3_id) q = q.eq('id', profile.up3_id)
  else if (profile.role !== 'super_admin') return NextResponse.json({ data: [] })

  const { data, error } = await q
  if (error) {
    console.error('[up3 GET]', error)
    return NextResponse.json({ error: 'Gagal memuat daftar UP3' }, { status: 500 })
  }

  // Sertakan jumlah ULP supaya UI bisa mencegah penghapusan yang merusak.
  const { data: ulps } = await admin.from('ulp').select('up3_id')
  const hitung = new Map<string, number>()
  for (const u of ulps ?? []) {
    const k = u.up3_id as string | null
    if (k) hitung.set(k, (hitung.get(k) ?? 0) + 1)
  }

  return NextResponse.json({
    data: (data ?? []).map((u) => ({ ...u, jumlahUlp: hitung.get(u.id as string) ?? 0 })),
  })
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || !bolehKelolaUp3(profile.role)) {
    return NextResponse.json({ error: 'Hanya Super Admin dan Admin UIW yang dapat menambah UP3' }, { status: 403 })
  }

  try {
    const { nama, kode, uiw_id } = await req.json()
    if (!nama?.trim() || !kode?.trim()) {
      return NextResponse.json({ error: 'Nama dan kode UP3 wajib diisi' }, { status: 400 })
    }

    // Admin UIW hanya boleh membuat UP3 di wilayahnya sendiri; super_admin
    // wajib menyebutkan wilayahnya secara eksplisit.
    const wilayah = profile.role === 'uiw' ? profile.uiw_id : uiw_id
    if (!wilayah) {
      return NextResponse.json({ error: 'UP3 harus dipasangkan ke satu UIW' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('up3')
      .insert({ nama: nama.trim(), kode: kode.trim().toUpperCase(), uiw_id: wilayah })
      .select('id, nama, kode, uiw_id, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Kode UP3 "${kode}" sudah dipakai` }, { status: 409 })
      }
      console.error('[up3 POST]', error)
      return NextResponse.json({ error: 'Gagal membuat UP3' }, { status: 500 })
    }

    return NextResponse.json({ data: { ...data, jumlahUlp: 0 } }, { status: 201 })
  } catch (e) {
    console.error('[up3 POST]', e)
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }
}
