import { createAdminClient } from '@/lib/supabase/admin'
import { buildPesanRekapGangguan } from '@/lib/wa/messages'
import { gatewayEnabled, getOpenSessionForUlp, gatewaySend } from '@/lib/wa/gateway'
import { getWaClient } from '@/lib/wa/client'

/**
 * Kirim teks ke grup WA sebuah ULP — dua jalur:
 * gateway (Baileys) jika aktif, fallback whatsapp-web.js in-process.
 * Mirror pola di lib/wa/send.ts.
 */
async function sendTextToUlpGroup(ulpId: string, waGrupId: string, text: string): Promise<boolean> {
  if (gatewayEnabled()) {
    const sessionId = await getOpenSessionForUlp(ulpId)
    if (!sessionId) return false
    await gatewaySend(sessionId, { to: waGrupId, text })
    return true
  }

  const admin = createAdminClient()
  const { data: userUlps } = await admin.from('user_ulp').select('user_id').eq('ulp_id', ulpId)
  for (const { user_id } of userUlps ?? []) {
    const client = getWaClient(user_id as string)
    if (client?.info) {
      await client.sendMessage(waGrupId, text)
      return true
    }
  }
  return false
}

export interface RekapGangguanResult {
  ulpId: string
  nama: string
  ok: boolean
  total: number
  reason?: string
  text?: string // hanya diisi saat dryRun
}

/**
 * Bangun & kirim rekap gangguan belum selesai untuk satu ULP.
 * `dryRun` → hanya bangun pesan (kembalikan `text`), tidak dikirim.
 */
export async function kirimRekapGangguanUlp(
  ulpId: string,
  opts: { dryRun?: boolean } = {},
): Promise<RekapGangguanResult> {
  const admin = createAdminClient()

  const { data: ulp } = await admin
    .from('ulp')
    .select('nama, wa_grup_id')
    .eq('id', ulpId)
    .single()

  if (!ulp) return { ulpId, nama: '—', ok: false, total: 0, reason: 'ulp_not_found' }
  if (!ulp.wa_grup_id) return { ulpId, nama: ulp.nama, ok: false, total: 0, reason: 'no_group' }

  const [{ data: regus }, { data: laporan }] = await Promise.all([
    admin.from('regu').select('id, nama').eq('ulp_id', ulpId).order('nama'),
    admin
      .from('laporan')
      .select('regu_id, nomor_tiket, nama_pelanggan, lokasi, keterangan, status, created_at')
      .eq('ulp_id', ulpId)
      .neq('status', 'selesai')
      .order('created_at', { ascending: true }),
  ])

  const now = new Date()
  const total = (laporan ?? []).length
  const pesan = buildPesanRekapGangguan(ulp.nama, regus ?? [], (laporan ?? []) as never, now)

  if (opts.dryRun) {
    return { ulpId, nama: ulp.nama, ok: true, total, text: pesan }
  }

  const sent = await sendTextToUlpGroup(ulpId, ulp.wa_grup_id, pesan)
  return { ulpId, nama: ulp.nama, ok: sent, total, reason: sent ? undefined : 'no_wa_session' }
}

/**
 * Kirim rekap ke SEMUA ULP yang punya wa_grup_id.
 * Ada jeda antar-ULP agar gateway tidak flooding (dilewati saat dryRun).
 */
export async function kirimRekapGangguanSemua(
  opts: { dryRun?: boolean } = {},
): Promise<RekapGangguanResult[]> {
  const admin = createAdminClient()
  const { data: ulps } = await admin
    .from('ulp')
    .select('id')
    .not('wa_grup_id', 'is', null)
    .order('nama')

  const results: RekapGangguanResult[] = []
  for (const u of ulps ?? []) {
    try {
      results.push(await kirimRekapGangguanUlp(u.id as string, opts))
    } catch (e) {
      results.push({ ulpId: u.id as string, nama: '—', ok: false, total: 0, reason: String(e) })
    }
    if (!opts.dryRun) await new Promise((r) => setTimeout(r, 1500)) // jeda antar ULP
  }
  return results
}

// ─── Scheduler in-app (tanpa dependency) ──────────────────────────────────
// Jalan tiap 3 jam pada jam bulat WIB: 00,03,06,09,12,15,18,21.

const TZ = 'Asia/Jakarta'
const SLOT_HOURS = [0, 3, 6, 9, 12, 15, 18, 21]
let schedulerStarted = false

/** ms sampai slot jam berikutnya (berdasarkan jam dinding TZ). */
function msUntilNextSlot(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  const secNow = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second')
  const slots = SLOT_HOURS.map((h) => h * 3600)
  const next = slots.find((s) => s > secNow + 1)
  const target = next ?? slots[0] + 24 * 3600 // besok slot pertama
  return (target - secNow) * 1000
}

/** Mulai scheduler (idempoten). Dipanggil dari instrumentation.ts saat boot. */
export function startRekapGangguanScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true

  const scheduleNext = () => {
    const delay = msUntilNextSlot()
    const fireAt = new Date(Date.now() + delay)
    console.log(`[RekapGangguan] Jadwal berikutnya: ${fireAt.toISOString()} (~${Math.round(delay / 60000)} mnt lagi)`)
    setTimeout(async () => {
      try {
        const res = await kirimRekapGangguanSemua()
        const ok = res.filter((r) => r.ok).length
        console.log(`[RekapGangguan] Terkirim ${ok}/${res.length} ULP`, res)
      } catch (e) {
        console.error('[RekapGangguan] Gagal kirim batch:', e)
      } finally {
        scheduleNext() // jadwalkan slot berikutnya
      }
    }, delay)
  }

  scheduleNext()
}
