import { format, formatDistanceToNow } from 'date-fns'

export function normJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
import { id } from 'date-fns/locale'

// WITA (UTC+8) — zona operasional APKT Mataram/NTB. Dipin ke zona ini, bukan ke
// timezone mesin, agar tampilan sama baik di laptop lokal maupun di VPS (UTC).
const TZ = 'Asia/Makassar'

function toWita(date: string | Date): Date {
  const d = new Date(date)
  return new Date(d.toLocaleString('en-US', { timeZone: TZ }))
}

export function formatTanggal(date: string | Date): string {
  return format(toWita(date), 'dd MMM yyyy', { locale: id })
}

export function formatWaktu(date: string | Date): string {
  return format(toWita(date), 'HH:mm', { locale: id })
}

export function formatTanggalWaktu(date: string | Date): string {
  return format(toWita(date), 'dd MMM yyyy, HH:mm', { locale: id })
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: id })
}

export function formatShiftLabel(nama: string, jamMulai: string, jamSelesai: string): string {
  return `${nama} | ${jamMulai}–${jamSelesai}`
}

/**
 * Durasi antara `from` dan `to` → "3 Hari 4 Jam" / "4 Jam 2 Menit" / "37 Menit".
 * Bebas timezone (selisih murni).
 *
 * Satuan hari wajib ada: gangguan tertunggak berhari-hari sebelumnya tercetak
 * sebagai "2120 Jam 3 Menit" yang tidak terbaca sebagai apa pun.
 * Hanya dua satuan terbesar yang ditampilkan supaya tetap ringkas.
 */
export function formatDurasi(from: string | Date, to: string | Date = new Date()): string {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalMenit = Math.floor(ms / 60000)
  const hari = Math.floor(totalMenit / 1440)
  const jam = Math.floor((totalMenit % 1440) / 60)
  const menit = totalMenit % 60
  if (hari > 0) return `${hari} Hari ${jam} Jam`
  if (jam > 0) return `${jam} Jam ${menit} Menit`
  return `${menit} Menit`
}
