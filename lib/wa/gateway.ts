import { createAdminClient } from '@/lib/supabase/admin'

// Klien HTTP ke wa-gateway (Baileys) — satu-satunya jalur WhatsApp aplikasi ini.
// APKT = SATU akun/tenant di gateway (1 API key). Tiap user APKT = 1 sesi gateway
// dengan id `apkt-<userId>`. Lihat DESIGN.md gateway.

// mis. https://gateway.commandcenter.my.id atau http://127.0.0.1:3001.
// Garis miring di akhir dibuang: gwFetch menyambung `${BASE}${path}` dan `path`
// sudah diawali '/', jadi ".../" akan menghasilkan "//sessions".
const BASE = process.env.WA_GATEWAY_URL?.replace(/\/+$/, '')
const KEY = process.env.WA_GATEWAY_KEY // API key tenant "monitoring-apkt"

/**
 * Aktif hanya jika WA_USE_GATEWAY=true DAN url+key terisi.
 * Tidak ada lagi jalur cadangan: kalau ini false, fitur WhatsApp mati dan
 * route terkait mengembalikan 503 dengan pesan yang jelas — bukan diam-diam
 * jatuh ke whatsapp-web.js yang menjalankan satu Chrome penuh per user.
 */
export function gatewayEnabled(): boolean {
  return process.env.WA_USE_GATEWAY === 'true' && !!BASE && !!KEY
}

/**
 * Mode pengembangan lokal: gateway WA tidak dihubungi sama sekali.
 * Pesan yang mestinya dikirim dicetak ke terminal, status dikembalikan stub,
 * dan tabel `wa_session` TIDAK disentuh — supaya dev lokal yang memakai
 * Supabase production tidak mengacaukan status koneksi WA yang sebenarnya.
 * Aktifkan dengan WA_OFFLINE=true di .env.local (jangan pernah di VPS).
 */
export function waOffline(): boolean {
  return process.env.WA_OFFLINE === 'true'
}

/**
 * Bolehkah instance ini memulai / memutus sesi WA di gateway?
 *
 * Session id hanya diturunkan dari user id (`apkt-{userId}`), tanpa penanda
 * lingkungan — jadi laptop dan VPS menunjuk sesi yang SAMA di gateway yang
 * sama. Menekan "Putuskan Koneksi" dari laptop memanggil
 * gatewayDeleteSession() pada sesi yang sedang dipakai production: sesinya
 * terhapus berikut kredensialnya, dan production harus scan QR ulang.
 *
 * Mengirim pesan dari laptop tidak berbahaya — itu hanya menumpang sesi yang
 * sudah terbuka. Yang berbahaya cuma dua tombol pengelola siklus hidup itu,
 * jadi hanya keduanya yang dipagari.
 *
 * Default true supaya VPS tidak perlu diubah sama sekali. Laptop
 * menonaktifkannya dengan WA_SESSION_CONTROL=false di .env.local.
 */
export function bolehKelolaSesi(): boolean {
  // Longgar dalam menerima bentuk "mati": default-nya mengizinkan (supaya VPS
  // tidak perlu diubah), jadi salah ketik di .env.local jatuh ke sisi yang
  // BERBAHAYA tanpa gejala apa pun. Menerima FALSE/0/off/no menutup celah itu
  // tanpa mengubah default-nya.
  const v = (process.env.WA_SESSION_CONTROL ?? '').trim().toLowerCase()
  return !['false', '0', 'off', 'no'].includes(v)
}

/** Pesan tolakan yang sama untuk kedua route, supaya tidak berbeda-beda. */
export const PESAN_KELOLA_SESI_DIMATIKAN =
  'Pengelolaan sesi WhatsApp dimatikan di instance ini (WA_SESSION_CONTROL=false). ' +
  'Sesi di gateway dipakai bersama dengan production — memulai atau memutusnya dari sini ' +
  'akan memaksa production scan QR ulang. Lakukan dari aplikasi di VPS.'

/** Gateway tak terjangkau (mati/timeout/jaringan), dibedakan dari "sesi tidak ada". */
export class GatewayUnreachableError extends Error {
  constructor(cause: string) {
    super(`wa-gateway tidak terjangkau di ${BASE}: ${cause}`)
    this.name = 'GatewayUnreachableError'
  }
}

/** Konvensi: satu sesi gateway per user APKT. */
export function sessionIdForUser(userId: string): string {
  return `apkt-${userId}`
}

export interface GatewaySession {
  id: string
  status: 'connecting' | 'qr' | 'open' | 'logged_out' | 'reconnecting'
  qr?: string | null
  pairingCode?: string | null
  meta?: { label?: string | null; phone?: string | null; webhookUrl?: string | null }
}

export type ApktWaStatus = 'loading' | 'scanning' | 'connected' | 'disconnected'
export interface ApktWaState {
  status: ApktWaStatus
  session_data: Record<string, unknown> | null
}

/** Petakan status gateway → bentuk yang dipakai UI/tabel wa_session APKT. */
export function mapGatewayToApkt(s: GatewaySession | null): ApktWaState {
  if (!s) return { status: 'disconnected', session_data: null }
  switch (s.status) {
    case 'qr':
      return {
        status: 'scanning',
        session_data: {
          ...(s.qr ? { qr: s.qr } : {}),
          ...(s.pairingCode ? { pairing_code: s.pairingCode } : {}),
        },
      }
    case 'open':
      return { status: 'connected', session_data: { wa_number: s.meta?.phone ?? null } }
    case 'connecting':
    case 'reconnecting':
      return { status: 'loading', session_data: null }
    default:
      return { status: 'disconnected', session_data: null }
  }
}

async function gwFetch(path: string, init?: RequestInit) {
  if (waOffline()) {
    throw new GatewayUnreachableError('WA_OFFLINE=true — gateway sengaja tidak dihubungi')
  }

  let res: Response
  try {
    // Tanpa timeout, gateway yang hang menahan request Next.js sampai tak terhingga.
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY as string, ...(init?.headers || {}) },
    })
  } catch (err) {
    // Gagal di level jaringan/timeout — gateway mati, bukan jawaban "sesi tidak ada".
    throw new GatewayUnreachableError(err instanceof Error ? err.message : String(err))
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status >= 500) throw new GatewayUnreachableError(`HTTP ${res.status}`)
    throw new Error(data.error || `gateway ${res.status}`)
  }
  return data
}

export async function gatewayListSessions(): Promise<GatewaySession[]> {
  const d = await gwFetch('/sessions')
  return (d.sessions as GatewaySession[]) || []
}

export async function gatewayGetSession(sessionId: string): Promise<GatewaySession | null> {
  const list = await gatewayListSessions()
  return list.find((s) => s.id === sessionId) ?? null
}

/** Mulai/daftar sesi untuk seorang user (idempoten). Kembalikan status + qr. */
export async function gatewayStartSession(
  userId: string,
  meta: { label?: string; webhookUrl?: string } = {},
): Promise<{ id: string; status: string }> {
  return gwFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify({ id: sessionIdForUser(userId), ...meta }),
  })
}

/** Ambil QR (dataURL) + status sesi seorang user (untuk halaman scan APKT). */
export async function gatewayGetQr(userId: string): Promise<{ qr: string | null; status: string }> {
  return gwFetch(`/sessions/${sessionIdForUser(userId)}/qr`)
}

export async function gatewayDeleteSession(userId: string): Promise<void> {
  await gwFetch(`/sessions/${sessionIdForUser(userId)}`, { method: 'DELETE' })
}

/** Minta pairing code (link via nomor HP). Sesi dimulai dulu kalau belum ada. */
export async function gatewayRequestPairingCode(userId: string, phone: string): Promise<{ code: string }> {
  await gatewayStartSession(userId)
  const d = await gwFetch(`/sessions/${sessionIdForUser(userId)}/pairing-code`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
  return { code: d.code }
}

/** Daftar grup WA nomor user (untuk pilih wa_grup_id). */
export async function gatewayListGroups(userId: string): Promise<{ id: string; nama: string }[]> {
  const d = await gwFetch(`/sessions/${sessionIdForUser(userId)}/groups`)
  return (d.groups as { id: string; nama: string }[]) || []
}

/**
 * Cari sesi gateway yang OPEN untuk sebuah ULP, di antara user ULP tersebut.
 */
// Cache pendek hasil pencarian sesi per ULP. Fungsi ini dipanggil pada SETIAP
// kiriman WA — tanpa cache, tiap laporan baru berarti satu query `user_ulp`
// plus satu tarikan daftar sesi dari gateway. Di volume ribuan laporan per hari
// itu ribuan round-trip untuk jawaban yang praktis tidak berubah.
// TTL sengaja pendek agar sesi yang putus tetap cepat terdeteksi.
const TTL_SESI_MS = 30_000
const cacheSesi = new Map<string, { sessionId: string | null; kedaluwarsa: number }>()

/** Buang cache sebuah ULP (atau semua) — panggil saat sesi WA berubah. */
export function resetCacheSesi(ulpId?: string): void {
  if (ulpId) cacheSesi.delete(ulpId)
  else cacheSesi.clear()
}

export async function getOpenSessionForUlp(ulpId: string): Promise<string | null> {
  // Offline: pura-pura ada sesi terbuka supaya alur kirim tetap berjalan sampai
  // gatewaySend(), yang akan mencetak pesannya ke terminal.
  if (waOffline()) return 'offline'

  const tersimpan = cacheSesi.get(ulpId)
  if (tersimpan && tersimpan.kedaluwarsa > Date.now()) return tersimpan.sessionId

  const admin = createAdminClient()
  const { data: userUlps } = await admin.from('user_ulp').select('user_id').eq('ulp_id', ulpId)
  const wanted = new Set((userUlps ?? []).map((u) => sessionIdForUser(u.user_id as string)))
  const sessions = await gatewayListSessions()
  const open = sessions.find((s) => wanted.has(s.id) && s.status === 'open')
  const sessionId = open?.id ?? null

  cacheSesi.set(ulpId, { sessionId, kedaluwarsa: Date.now() + TTL_SESI_MS })
  return sessionId
}

export interface GatewaySendPayload {
  to: string
  text?: string
  mediaUrl?: string
  caption?: string
  mentions?: string[]
  replyTo?: string
}

/** Kirim pesan lewat gateway. Kembalikan message id (untuk simpan wa_message_id). */
export async function gatewaySend(
  sessionId: string,
  payload: GatewaySendPayload,
): Promise<{ id?: string }> {
  if (waOffline()) {
    const garis = '─'.repeat(52)
    console.log(
      `\n┌─ WA OFFLINE — tidak dikirim ${garis}\n` +
        `│ tujuan : ${payload.to}\n` +
        (payload.mentions?.length ? `│ mention: ${payload.mentions.join(', ')}\n` : '') +
        `├${garis}──────────────────────────────\n` +
        (payload.text ?? payload.caption ?? '(tanpa teks)')
          .split('\n')
          .map((l) => `│ ${l}`)
          .join('\n') +
        `\n└${garis}──────────────────────────────\n`,
    )
    return { id: `offline-${Date.now()}` }
  }

  const d = await gwFetch(`/sessions/${sessionId}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { id: d.id }
}
