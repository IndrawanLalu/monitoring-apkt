import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peranPengelola } from '@/lib/otorisasi'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!profile.up3_id) {
    return NextResponse.json({ error: 'Akun admin belum terhubung ke UP3' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ulp')
    .select('id, nama, kode, created_at')
    .eq('up3_id', profile.up3_id)
    .order('nama')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!profile.up3_id) {
    return NextResponse.json({ error: 'Akun admin belum terhubung ke UP3' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const body = await req.json()
    const { nama, kode } = body

    if (!nama?.trim() || !kode?.trim()) {
      return NextResponse.json({ error: 'Nama dan kode ULP wajib diisi' }, { status: 400 })
    }

    // 1. Insert ULP baru dengan up3_id admin
    const { data: newUlp, error: ulpError } = await admin
      .from('ulp')
      .insert({ nama: nama.trim(), kode: kode.trim().toUpperCase(), up3_id: profile.up3_id })
      .select('id, nama, kode, created_at')
      .single()

    if (ulpError) {
      const msg = ulpError.message.includes('unique') ? `Kode ULP "${kode.trim().toUpperCase()}" sudah digunakan` : ulpError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // 2. Tambahkan ULP ke user_ulp admin agar bisa langsung dikelola
    await admin.from('user_ulp').insert({ user_id: profile.id, ulp_id: newUlp.id })

    return NextResponse.json({ data: newUlp })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
