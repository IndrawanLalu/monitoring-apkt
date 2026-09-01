import { NextResponse } from 'next/server'
import { getProfile, type UserProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Admin boleh menjangkau ULP lain selama masih satu UP3 dengannya.
  if (profile.role === 'admin' && profile.up3_id) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('ulp')
      .select('id')
      .eq('id', ulpId)
      .eq('up3_id', profile.up3_id)
      .maybeSingle()
    if (data) return { profile, data: { ulpId } }
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
 * Operator biasa: hanya ULP yang di-assign ke dirinya.
 * Admin ber-UP3: SELURUH ULP di UP3-nya — supaya dashboard manajemen bisa
 * membandingkan antar-ULP, bukan hanya yang kebetulan di-assign.
 *
 * Ini melebarkan cakupan BACA saja. Jalur tulis tetap lewat requireUlp(),
 * yang memang sudah mengizinkan admin menjangkau ULP satu UP3.
 */
export async function ulpIdsTerlihat(profile: UserProfile): Promise<string[]> {
  const milikSendiri = profile.ulps.map((u) => u.id)

  if (profile.role !== 'admin' || !profile.up3_id) return milikSendiri

  const admin = createAdminClient()
  const { data } = await admin.from('ulp').select('id').eq('up3_id', profile.up3_id)
  const seUp3 = (data ?? []).map((u) => u.id as string)

  // Gabung: kalau kolom up3_id belum terisi untuk sebagian ULP, akses lama
  // tetap dipertahankan alih-alih hilang.
  return Array.from(new Set([...milikSendiri, ...seUp3]))
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
