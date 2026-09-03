/**
 * Ringkas galat untuk log server.
 *
 * Mencetak objek galat Supabase apa adanya menyalin data pelanggan ke log:
 * PostgREST menaruh nilai baris yang melanggar constraint di `details` —
 * mis. `Key (nomor_lapor)=(G4426090100401) already exists.` — sementara
 * `code` dan `message` hanya menyebut nama constraint-nya. Log PM2 di VPS
 * tidak punya batas usia, jadi apa pun yang tercetak di sana bertahan
 * berbulan-bulan dan ikut terbaca siapa pun yang punya akses SSH.
 *
 * `code` + `message` sudah cukup untuk menelusuri masalah; `details` dan
 * `hint` sengaja dibuang karena hanya itu yang menggemakan isi baris.
 */
export function ringkasGalat(e: unknown): string {
  if (e === null || e === undefined) return 'galat tanpa keterangan'
  if (typeof e === 'string') return e

  const o = e as { code?: unknown; message?: unknown; name?: unknown }
  const kode = typeof o.code === 'string' || typeof o.code === 'number' ? `${o.code}: ` : ''
  const pesan =
    typeof o.message === 'string'
      ? o.message
      : e instanceof Error
        ? e.message
        : typeof o.name === 'string'
          ? o.name
          : 'galat tanpa pesan'

  return `${kode}${pesan}`
}
