import { format, formatDistanceToNow } from 'date-fns'

export function normJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
import { id } from 'date-fns/locale'

export function formatTanggal(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy', { locale: id })
}

export function formatWaktu(date: string | Date): string {
  return format(new Date(date), 'HH:mm', { locale: id })
}

export function formatTanggalWaktu(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: id })
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: id })
}

export function formatShiftLabel(nama: string, jamMulai: string, jamSelesai: string): string {
  return `${nama} | ${jamMulai}–${jamSelesai}`
}
