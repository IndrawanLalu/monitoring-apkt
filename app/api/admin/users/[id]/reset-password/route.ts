import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peranPengelola } from '@/lib/otorisasi'
import { catatAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Reset password oleh admin, bukan lewat email.
 *
 * Akun di sistem ini berpola `ulpampenan@smart.com`, `jtmgerung@smart.com` —
 * kotak surat bersama yang belum tentu bisa diakses pemiliknya. Alur "Lupa
 * Password" lewat email jadi tidak berguna. Karena itu admin yang mereset,
 * lalu menyampaikan password sementara secara langsung.
 *
 * Password sementara dibuat acak, bukan pola tetap seperti "pln12345":
 * pola tetap berarti setiap akun yang baru direset punya password yang sama
 * dan bisa ditebak siapa pun yang tahu kebiasaannya.
 */
function passwordSementara(): string {
  // Huruf & angka tanpa karakter yang mudah tertukar (0/O, 1/l/I) — password
  // ini akan dibacakan atau diketik ulang oleh orang.
  const huruf = 'abcdefghjkmnpqrstuvwxyz'
  const angka = '23456789'
  const acak = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('')
  // Bentuknya selalu memenuhi aturan: minimal 8 karakter, ada huruf dan angka.
  return `${acak(huruf, 3)}${acak(angka, 3)}${acak(huruf, 3)}`
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  // Reset password akun sendiri tidak lewat sini — pemiliknya bisa
  // menggantinya langsung, dan mereset diri sendiri hanya menambah risiko
  // terkunci kalau password sementaranya hilang.
  if (id === profile.id) {
    return NextResponse.json(
      { error: 'Untuk mengubah password Anda sendiri, gunakan tombol Edit pada akun Anda.' },
      { status: 400 },
    )
  }

  // Sasaran harus berada dalam cakupan ULP si pemanggil.
  const ulpIds = profile.ulps.map((u) => u.id)
  const { data: milik } = await admin
    .from('user_ulp').select('user_id').eq('user_id', id).in('ulp_id', ulpIds).limit(1)

  const { data: sasaran } = await admin
    .from('profiles').select('nama, role, up3_id, uiw_id').eq('id', id).maybeSingle()

  if (!sasaran) {
    return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
  }

  // Akun tingkat pengelola tidak punya baris user_ulp, jadi kecocokannya
  // diperiksa lewat hierarki. super_admin boleh mereset siapa pun.
  const dalamCakupan =
    profile.role === 'super_admin' ||
    (milik ?? []).length > 0 ||
    (profile.role === 'uiw' && sasaran.uiw_id === profile.uiw_id) ||
    (sasaran.up3_id && sasaran.up3_id === profile.up3_id)

  if (!dalamCakupan) {
    return NextResponse.json({ error: 'Akun di luar wewenang Anda' }, { status: 403 })
  }

  const baru = passwordSementara()
  const { error } = await admin.auth.admin.updateUserById(id, { password: baru })
  if (error) {
    console.error('[reset-password]', error)
    return NextResponse.json({ error: 'Gagal mereset password' }, { status: 500 })
  }

  await catatAudit({
    aktorId: profile.id,
    aktorNama: profile.nama,
    aksi: 'reset_password',
    sasaranId: id,
    sasaranNama: sasaran.nama as string,
  })

  // Password sementara dikembalikan SEKALI ini saja — tidak disimpan di mana
  // pun dan tidak bisa dilihat lagi setelah dialognya ditutup.
  return NextResponse.json({ password: baru })
}
