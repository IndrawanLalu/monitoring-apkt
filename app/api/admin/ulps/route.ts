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
  const admin = createAdminClient()

  // Cakupan mengikuti peran. Versi lama mewajibkan profile.up3_id, sehingga
  // super_admin — yang memang tidak punya UP3 — ditolak dan halaman Kelola ULP
  // gagal terbuka untuknya.
  let q = admin.from('ulp').select('id, nama, kode, up3_id, created_at').order('nama')

  if (profile.role === 'uiw' && profile.uiw_id) {
    const { data: up3s } = await admin.from('up3').select('id').eq('uiw_id', profile.uiw_id)
    q = q.in('up3_id', (up3s ?? []).map((u) => u.id as string))
  } else if (profile.role !== 'super_admin') {
    if (!profile.up3_id) {
      return NextResponse.json({ error: 'Akun Anda belum terhubung ke UP3' }, { status: 400 })
    }
    q = q.eq('up3_id', profile.up3_id)
  }

  const { data, error } = await q
  if (error) {
    console.error('[ulps GET]', error)
    return NextResponse.json({ error: 'Gagal memuat daftar ULP' }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const admin = createAdminClient()

  try {
    const body = await req.json()
    const { nama, kode, up3_id } = body

    if (!nama?.trim() || !kode?.trim()) {
      return NextResponse.json({ error: 'Nama dan kode ULP wajib diisi' }, { status: 400 })
    }

    // UP3 tujuan: dipilih dari UI untuk super_admin dan uiw, sedangkan akun
    // 'up3' selalu memakai UP3-nya sendiri apa pun yang dikirim klien.
    const up3Tujuan = profile.role === 'up3' || profile.role === 'admin'
      ? profile.up3_id
      : up3_id

    if (!up3Tujuan) {
      return NextResponse.json({ error: 'Pilih UP3 induk untuk ULP ini' }, { status: 400 })
    }

    // Jangan sampai admin UIW membuat ULP di UP3 wilayah lain hanya dengan
    // mengirim id yang berbeda di body.
    if (profile.role === 'uiw') {
      const { data: sah } = await admin.from('up3').select('id')
        .eq('id', up3Tujuan).eq('uiw_id', profile.uiw_id ?? '').maybeSingle()
      if (!sah) {
        return NextResponse.json({ error: 'UP3 di luar wilayah Anda' }, { status: 403 })
      }
    }

    // 1. Insert ULP baru dengan up3_id admin
    const { data: newUlp, error: ulpError } = await admin
      .from('ulp')
      .insert({ nama: nama.trim(), kode: kode.trim().toUpperCase(), up3_id: up3Tujuan })
      .select('id, nama, kode, up3_id, created_at')
      .single()

    if (ulpError) {
      const msg = ulpError.message.includes('unique') ? `Kode ULP "${kode.trim().toUpperCase()}" sudah digunakan` : ulpError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // 2. Untuk peran yang cakupannya berasal dari assignment, ULP baru
    // ditambahkan ke user_ulp-nya agar langsung terlihat. super_admin, uiw,
    // dan up3 tidak perlu — cakupan mereka datang dari hierarki.
    if (!['super_admin', 'uiw', 'up3'].includes(profile.role)) {
      await admin.from('user_ulp').insert({ user_id: profile.id, ulp_id: newUlp.id })
    }

    return NextResponse.json({ data: newUlp })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
