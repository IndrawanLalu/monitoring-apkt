import { format, formatDistanceToNow } from 'date-fns'

export function normJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
import { id } from 'date-fns/locale'

const TZ = 'Asia/Jakarta'

function toJkt(date: string | Date): Date {
  const d = new Date(date)
  return new Date(d.toLocaleString('en-US', { timeZone: TZ }))
}

export function formatTanggal(date: string | Date): string {
  return format(toJkt(date), 'dd MMM yyyy', { locale: id })
}

export function formatWaktu(date: string | Date): string {
  return format(toJkt(date), 'HH:mm', { locale: id })
}

export function formatTanggalWaktu(date: string | Date): string {
  return format(toJkt(date), 'dd MMM yyyy, HH:mm', { locale: id })
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: id })
}

export function formatShiftLabel(nama: string, jamMulai: string, jamSelesai: string): string {
  return `${nama} | ${jamMulai}–${jamSelesai}`
}

/** Durasi antara `from` dan `to` → "4 Jam 2 Menit" / "37 Menit". Bebas timezone (selisih murni). */
export function formatDurasi(from: string | Date, to: string | Date = new Date()): string {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalMenit = Math.floor(ms / 60000)
  const jam = Math.floor(totalMenit / 60)
  const menit = totalMenit % 60
  return jam > 0 ? `${jam} Jam ${menit} Menit` : `${menit} Menit`
}
