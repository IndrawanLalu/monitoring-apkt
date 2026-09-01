'use server'

import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import { rateLimit, ipPemanggil } from '@/lib/rate-limit'

const COOKIE = 'rekap_auth'
const UMUR_DETIK = 60 * 60 * 24 * 7 // 1 minggu

/**
 * Sandi halaman rekap publik.
 *
 * Sebelumnya tertulis langsung di source ('KITABISA') dan ikut ter-commit,
 * sementara halaman yang dijaganya menampilkan PII pelanggan SELURUH ULP
 * (nama, alamat, nomor tiket, isi saran survey). Sekarang dari env, dan
 * nilai cookie-nya ditandatangani HMAC + kedaluwarsa — bukan lagi string
 * statis 'authenticated' yang berlaku selamanya.
 */
function sandi(): string | null {
  return process.env.REKAP_PASSWORD || null
}

function kunciTandaTangan(): string {
  // MAGIC_LINK_SECRET sudah ada di env dan tidak lagi dipakai sejak magic link
  // dihapus; dipakai ulang di sini supaya tidak menambah variabel baru.
  return process.env.REKAP_SECRET || process.env.MAGIC_LINK_SECRET || ''
}

function tandaTangani(kedaluwarsa: number): string {
  return createHmac('sha256', kunciTandaTangan()).update(String(kedaluwarsa)).digest('hex')
}

/** Bandingkan tanpa membocorkan panjang/isi lewat waktu eksekusi. */
function samaAman(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    // Tetap lakukan satu perbandingan agar durasinya tidak menandakan apa pun.
    timingSafeEqual(ba, ba)
    return false
  }
  return timingSafeEqual(ba, bb)
}

/** Dipanggil server component untuk memutuskan tampilkan rekap atau form sandi. */
export async function rekapTerbuka(): Promise<boolean> {
  const nilai = (await cookies()).get(COOKIE)?.value
  if (!nilai) return false

  const [kedaluwarsaStr, tanda] = nilai.split('.')
  const kedaluwarsa = Number(kedaluwarsaStr)
  if (!kedaluwarsa || !tanda || Date.now() > kedaluwarsa) return false

  return samaAman(tanda, tandaTangani(kedaluwarsa))
}

export async function checkPassword(formData: FormData) {
  const ip = ipPemanggil(await headers())
  const batas = rateLimit(`rekap:${ip}`, 8, 10 * 60_000) // 8 percobaan / 10 menit
  if (!batas.lolos) {
    return {
      success: false,
      error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(batas.cobaLagiDetik / 60)} menit.`,
    }
  }

  const benar = sandi()
  if (!benar) {
    return { success: false, error: 'REKAP_PASSWORD belum di-set di server.' }
  }
  if (!kunciTandaTangan()) {
    return { success: false, error: 'REKAP_SECRET / MAGIC_LINK_SECRET belum di-set di server.' }
  }

  const diberikan = String(formData.get('password') ?? '')
  if (!samaAman(diberikan, benar)) {
    return { success: false, error: 'Sandi salah. Coba lagi.' }
  }

  const kedaluwarsa = Date.now() + UMUR_DETIK * 1000
  ;(await cookies()).set(COOKIE, `${kedaluwarsa}.${tandaTangani(kedaluwarsa)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: UMUR_DETIK,
  })
  return { success: true }
}

export async function logoutRekap() {
  ;(await cookies()).delete(COOKIE)
}

/** Bantu operator membuat nilai REKAP_SECRET saat setup. */
export async function usulkanSecret(): Promise<string> {
  return randomBytes(32).toString('hex')
}
