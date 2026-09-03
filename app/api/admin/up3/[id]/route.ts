import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ringkasGalat } from '@/lib/log'

export const dynamic = 'force-dynamic'

/** Pastikan UP3 ini berada dalam wewenang si pemanggil. */
async function bolehSentuh(
  admin: ReturnType<typeof createAdminClient>,
  profile: { role: string; uiw_id: string | null },
  up3Id: string,
): Promise<boolean> {
  if (profile.role === 'super_admin') return true
  if (profile.role !== 'uiw' || !profile.uiw_id) return false
  const { data } = await admin
    .from('up3').select('id').eq('id', up3Id).eq('uiw_id', profile.uiw_id).maybeSingle()
  return !!data
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  if (!(await bolehSentuh(admin, profile, id))) {
    return NextResponse.json({ error: 'UP3 tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  try {
    const { nama, kode } = await req.json()
    const ubah: Record<string, string> = {}
    if (nama?.trim()) ubah.nama = nama.trim()
    if (kode?.trim()) ubah.kode = kode.trim().toUpperCase()
    if (Object.keys(ubah).length === 0) {
      return NextResponse.json({ error: 'Tidak ada yang diubah' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('up3').update(ubah).eq('id', id)
      .select('id, nama, kode, uiw_id, created_at').single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Kode UP3 sudah dipakai' }, { status: 409 })
      }
      console.error('[up3 PATCH]', ringkasGalat(error))
      return NextResponse.json({ error: 'Gagal menyimpan perubahan UP3' }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e) {
    console.error('[up3 PATCH]', ringkasGalat(e))
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  if (!(await bolehSentuh(admin, profile, id))) {
    return NextResponse.json({ error: 'UP3 tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  // Ditolak selagi masih ada yang bergantung padanya. Foreign key-nya
  // `on delete restrict`, tapi memeriksa lebih dulu memungkinkan pesan yang
  // menjelaskan APA yang menghalangi, bukan sekadar galat constraint.
  const [{ count: jmlUlp }, { count: jmlAkun }] = await Promise.all([
    admin.from('ulp').select('*', { count: 'exact', head: true }).eq('up3_id', id),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('up3_id', id),
  ])

  if ((jmlUlp ?? 0) > 0 || (jmlAkun ?? 0) > 0) {
    const bagian: string[] = []
    if (jmlUlp) bagian.push(`${jmlUlp} ULP`)
    if (jmlAkun) bagian.push(`${jmlAkun} akun pengguna`)
    return NextResponse.json(
      { error: `UP3 ini masih memiliki ${bagian.join(' dan ')}. Pindahkan atau hapus dulu.` },
      { status: 409 },
    )
  }

  const { error } = await admin.from('up3').delete().eq('id', id)
  if (error) {
    console.error('[up3 DELETE]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal menghapus UP3' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
