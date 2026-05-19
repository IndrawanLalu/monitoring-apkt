import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function verifyUlpAccess(admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>, ulpId: string, up3Id: string) {
  const { data } = await admin.from('ulp').select('id').eq('id', ulpId).eq('up3_id', up3Id).maybeSingle()
  return !!data
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!profile.up3_id) {
    return NextResponse.json({ error: 'Akun admin belum terhubung ke UP3' }, { status: 400 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const hasAccess = await verifyUlpAccess(admin, id, profile.up3_id)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ULP tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { nama, kode } = body

    if (!nama?.trim() || !kode?.trim()) {
      return NextResponse.json({ error: 'Nama dan kode ULP wajib diisi' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('ulp')
      .update({ nama: nama.trim(), kode: kode.trim().toUpperCase() })
      .eq('id', id)
      .select('id, nama, kode, created_at')
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
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!profile.up3_id) {
    return NextResponse.json({ error: 'Akun admin belum terhubung ke UP3' }, { status: 400 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const hasAccess = await verifyUlpAccess(admin, id, profile.up3_id)
  if (!hasAccess) {
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
