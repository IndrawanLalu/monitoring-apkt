import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Hanya Super Admin yang dapat mengubah UIW' }, { status: 403 })
  }

  const { id } = await params

  try {
    const { nama, kode } = await req.json()
    const ubah: Record<string, string> = {}
    if (nama?.trim()) ubah.nama = nama.trim()
    if (kode?.trim()) ubah.kode = kode.trim().toUpperCase()
    if (Object.keys(ubah).length === 0) {
      return NextResponse.json({ error: 'Tidak ada yang diubah' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('uiw').update(ubah).eq('id', id)
      .select('id, nama, kode, created_at').single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Kode UIW sudah dipakai' }, { status: 409 })
      }
      console.error('[uiw PATCH]', error)
      return NextResponse.json({ error: 'Gagal menyimpan perubahan UIW' }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e) {
    console.error('[uiw PATCH]', e)
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Hanya Super Admin yang dapat menghapus UIW' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const [{ count: jmlUp3 }, { count: jmlAkun }] = await Promise.all([
    admin.from('up3').select('*', { count: 'exact', head: true }).eq('uiw_id', id),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('uiw_id', id),
  ])

  if ((jmlUp3 ?? 0) > 0 || (jmlAkun ?? 0) > 0) {
    const bagian: string[] = []
    if (jmlUp3) bagian.push(`${jmlUp3} UP3`)
    if (jmlAkun) bagian.push(`${jmlAkun} akun pengguna`)
    return NextResponse.json(
      { error: `UIW ini masih memiliki ${bagian.join(' dan ')}. Pindahkan atau hapus dulu.` },
      { status: 409 },
    )
  }

  const { error } = await admin.from('uiw').delete().eq('id', id)
  if (error) {
    console.error('[uiw DELETE]', error)
    return NextResponse.json({ error: 'Gagal menghapus UIW' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
