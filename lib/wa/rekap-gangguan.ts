import { createAdminClient } from '@/lib/supabase/admin'
import { buildPesanRekapGangguan } from '@/lib/wa/messages'
import { kirimTeksKeGrupUlp } from '@/lib/wa/send'
import { cariPiketAktif } from '@/lib/piket'

/** Bungkus kirimTeksKeGrupUlp jadi boolean — scheduler tidak boleh berhenti karena 1 ULP gagal. */
async function sendTextToUlpGroup(ulpId: string, waGrupId: string, text: string): Promise<boolean> {
  try {
    await kirimTeksKeGrupUlp(ulpId, waGrupId, text)
    return true
  } catch (e) {
    console.error(`[WA] rekap gangguan ULP ${ulpId} gagal:`, e)
    return false
  }
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
  const belum = laporan ?? []
  const total = belum.length

  // Hitungan status untuk sesi piket berjalan.
  // - Status terbuka: semua yang belum selesai saat ini (itulah yang sedang dipegang shift).
  // - Selesai: HANYA yang diselesaikan piket ini, lewat resolved_piket_id.
  //   `laporan.piket_id` tidak bisa dipakai — NULL untuk seluruh baris di database.
  const piket = await cariPiketAktif(admin, ulpId, now)
  let sesi: Parameters<typeof buildPesanRekapGangguan>[4] = null

  if (piket) {
    const { count: selesai } = await admin
      .from('laporan')
      .select('*', { count: 'exact', head: true })
      .eq('resolved_piket_id', piket.id)

    sesi = {
      shiftNama: piket.nama,
      jamMulai: piket.jamMulai.slice(0, 5),
      jamSelesai: piket.jamSelesai.slice(0, 5),
      hitungan: {
        lapor: belum.filter((l) => l.status === 'lapor').length,
        penugasan_regu: belum.filter((l) => l.status === 'penugasan_regu').length,
        ditangani: belum.filter((l) => l.status === 'ditangani').length,
        nyala_sementara: belum.filter((l) => l.status === 'nyala_sementara').length,
        selesai: selesai ?? 0,
      },
    }
  }

  const pesan = buildPesanRekapGangguan(ulp.nama, regus ?? [], belum as never, now, sesi)

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
// Jalan tiap 3 jam pada jam bulat WITA: 00,03,06,09,12,15,18,21.

// WITA — zona operasional. Sebelumnya 'Asia/Jakarta' (WIB) sehingga rekap
// terkirim pukul 01,04,07,… WITA, meleset satu jam dari yang dimaksud.
const TZ = 'Asia/Makassar'
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
