import { createAdminClient } from '@/lib/supabase/admin'

// Klien HTTP ke wa-gateway (Baileys). Menggantikan whatsapp-web.js in-process.
// APKT = SATU akun/tenant di gateway (1 API key). Tiap user APKT = 1 sesi gateway
// dengan id `apkt-<userId>`. Lihat DESIGN.md gateway.

const BASE = process.env.WA_GATEWAY_URL // mis. http://127.0.0.1:3001
const KEY = process.env.WA_GATEWAY_KEY // API key tenant "monitoring-apkt"

/**
 * Aktif hanya jika WA_USE_GATEWAY=true DAN url+key terisi.
 * Default OFF → kirim tetap lewat whatsapp-web.js lama (produksi aman).
 */
export function gatewayEnabled(): boolean {
  return process.env.WA_USE_GATEWAY === 'true' && !!BASE && !!KEY
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
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY as string, ...(init?.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `gateway ${res.status}`)
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
 * Cari sesi gateway yang OPEN untuk sebuah ULP (di antara user ULP tsb).
 * Pengganti getWaClientForUlp() versi whatsapp-web.js.
 */
export async function getOpenSessionForUlp(ulpId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: userUlps } = await admin.from('user_ulp').select('user_id').eq('ulp_id', ulpId)
  const wanted = new Set((userUlps ?? []).map((u) => sessionIdForUser(u.user_id as string)))
  const sessions = await gatewayListSessions()
  const open = sessions.find((s) => wanted.has(s.id) && s.status === 'open')
  return open?.id ?? null
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
  const d = await gwFetch(`/sessions/${sessionId}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { id: d.id }
}
