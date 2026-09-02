import { NextResponse } from 'next/server'
import { getProfile, type UserProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERAN_PENGELOLA } from '@/constants'

/**
 * Otorisasi tingkat-resource untuk route API.
 *
 * Route di aplikasi ini memakai admin client (service role) yang MENEMBUS RLS,
 * jadi memastikan "user sudah login" saja tidak cukup — tanpa pemeriksaan
 * kepemilikan, satu akun operator bisa mengubah dan menghapus data ULP mana pun.
 *
 * Pola: panggil requireUlp()/requireLaporan() di awal handler, dan kalau hasilnya
 * punya `.response`, kembalikan itu apa adanya.
 */

export type HasilOtorisasi<T> =
  | { response: NextResponse; profile?: never; data?: never }
  | { response?: never; profile: UserProfile; data: T }

function tolak(pesan: string, status: number): { response: NextResponse } {
  return { response: NextResponse.json({ error: pesan }, { status }) }
}

/** Profil user yang sedang login, atau 401. */
export async function requireProfile(): Promise<HasilOtorisasi<null>> {
  const profile = await getProfile()
  if (!profile) return tolak('Unauthorized', 401)
  return { profile, data: null }
}

/** Pastikan user berhak atas `ulpId`. Admin dibatasi ke UP3-nya sendiri. */
export async function requireUlp(ulpId: string | null | undefined): Promise<HasilOtorisasi<{ ulpId: string }>> {
  const profile = await getProfile()
  if (!profile) return tolak('Unauthorized', 401)
  if (!ulpId) return tolak('ulp_id diperlukan', 400)

  if (profile.ulps.some((u) => u.id === ulpId)) {
    return { profile, data: { ulpId } }
  }

  // Peran pengelola boleh menjangkau ULP di luar assignment-nya, sebatas
  // tingkatnya masing-masing. Diperiksa terhadap daftar cakupan yang sama
  // dengan yang dipakai halaman baca, supaya tidak ada dua sumber kebenaran.
  if (peranPengelola(profile.role)) {
    const terlihat = await ulpIdsTerlihat(profile)
    if (terlihat.includes(ulpId)) return { profile, data: { ulpId } }
  }

  return tolak('ULP tidak ditemukan atau di luar wewenang Anda', 403)
}

/**
 * Ambil laporan sekaligus pastikan user berhak atas ULP-nya.
 * Mengembalikan 403 (bukan 404) untuk laporan milik ULP lain agar keberadaan
 * id tidak bisa diintip dari luar.
 */
export async function requireLaporan(
  laporanId: string,
): Promise<HasilOtorisasi<{ laporan: Record<string, unknown> }>> {
  const profile = await getProfile()
  if (!profile) return tolak('Unauthorized', 401)

  const admin = createAdminClient()
  const { data: laporan } = await admin
    .from('laporan')
    .select('id, status, keterangan, ulp_id, regu_id, nomor_tiket, piket_id')
    .eq('id', laporanId)
    .maybeSingle()

  if (!laporan) return tolak('Laporan tidak ditemukan', 404)

  const izin = await requireUlp(laporan.ulp_id as string)
  if (izin.response) return tolak('Laporan di luar wewenang Anda', 403)

  return { profile, data: { laporan: laporan as Record<string, unknown> } }
}

/**
 * Semua ULP yang boleh dilihat sebuah profil.
 *
 * Cakupannya sudah diselesaikan getProfile() menurut peran — super_admin
 * seluruh sistem, uiw se-wilayah, up3 se-UP3, operator sesuai assignment.
 * Fungsi ini sengaja tinggal membaca hasilnya, bukan menghitung ulang:
 * dua tempat yang menghitung cakupan sendiri-sendiri pasti akan menyimpang.
 */
export async function ulpIdsTerlihat(profile: UserProfile): Promise<string[]> {
  return profile.ulps.map((u) => u.id)
}

/** Apakah peran ini boleh mengelola user, ULP, dan pengaturan. */
export function peranPengelola(role: string): boolean {
  return (PERAN_PENGELOLA as readonly string[]).includes(role)
}

/** Pastikan `reguId` benar-benar milik `ulpId` — mencegah pasangan regu/ULP silang. */
export async function reguMilikUlp(reguId: string, ulpId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('regu')
    .select('id')
    .eq('id', reguId)
    .eq('ulp_id', ulpId)
    .maybeSingle()
  return !!data
}

/**
 * Pastikan user berhak atas ULP pemilik sebuah baris di tabel `tabel`.
 * Dipakai route [id] untuk regu / petugas_apkt / piket yang semuanya punya ulp_id.
 */
export async function requireBarisUlp(
  tabel: 'regu' | 'petugas_apkt' | 'piket',
  id: string,
): Promise<HasilOtorisasi<{ ulpId: string }>> {
  const profile = await getProfile()
  if (!profile) return tolak('Unauthorized', 401)

  const admin = createAdminClient()
  const { data } = await admin.from(tabel).select('id, ulp_id').eq('id', id).maybeSingle()
  if (!data) return tolak('Data tidak ditemukan', 404)

  const izin = await requireUlp(data.ulp_id as string)
  if (izin.response) return tolak('Data di luar wewenang Anda', 403)

  return { profile, data: { ulpId: data.ulp_id as string } }
}
