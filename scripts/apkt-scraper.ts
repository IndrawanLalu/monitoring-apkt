/**
 * APKT Scraper — jalankan dengan: pnpm apkt
 *
 * Alur:
 * 1. Buka Chrome headed → navigate ke APKT
 * 2. Tunggu user login (deteksi otomatis dari URL)
 * 3. Tunggu sinyal "Mulai Polling" dari monitoring app
 * 4. Klik Cari + scrape tabel setiap 60 detik
 * 5. Monitoring app bisa hentikan scraper kapanpun (tombol "Hentikan")
 */

import { chromium, type Page, type BrowserContext } from 'playwright'
import { APKT_STATUS_MAP, type LaporanApkt } from '../lib/apkt/types'
import fs from 'fs'
import path from 'path'

const SESSION_FILE = path.join(process.cwd(), '.apkt-session.json')

const APKT_URL = 'https://new-apktss.pln.co.id/home/monitoring-all'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const POLL_INTERVAL_MS = 300_000 // 5 menit
const COMMAND_POLL_MS = 3_000

// ── Komunikasi dengan monitoring app ─────────────────────────────────────────

async function postStatus(status: string, error?: string) {
  await fetch(`${APP_URL}/api/apkt/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'status', status, error }),
  }).catch((e) => console.warn('⚠️  Gagal kirim status:', e.message))
}

async function postData(data: LaporanApkt[]) {
  await fetch(`${APP_URL}/api/apkt/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'data', data }),
  }).catch((e) => console.warn('⚠️  Gagal kirim data:', e.message))
}

async function getCommand(): Promise<string | null> {
  try {
    const res = await fetch(`${APP_URL}/api/apkt/data`)
    if (!res.ok) return null
    const state = await res.json() as { pendingCommand: string | null }
    return state.pendingCommand
  } catch {
    return null
  }
}

async function consumeCommand() {
  await fetch(`${APP_URL}/api/apkt/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'consume_command' }),
  }).catch(() => {})
}

// ── Scraping ──────────────────────────────────────────────────────────────────

async function scrapeTable(page: Page): Promise<LaporanApkt[]> {
  const rows = await page.$$eval('table tbody tr', (trs) =>
    trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td'))
      // 0=No, 1=No.Lapor, 2=Prioritas, 3=Name, 4=Durasi, 5=Status,
      // 6=Alamat Pelapor, 7=Lokasi, 8=Posko, 9=No.Telepon,
      // 10=Deskripsi, 11=Penyebab, 12=Tanggal Lapor
      return {
        nomorLapor:     cells[1]?.textContent?.trim()  ?? '',
        namaPelanggan:  cells[3]?.textContent?.trim()  ?? '',
        durasi:         cells[4]?.textContent?.trim()  ?? '',
        status:         cells[5]?.textContent?.trim()  ?? '',
        alamatPelapor:  cells[6]?.textContent?.trim()  ?? '',
        lokasi:         cells[7]?.textContent?.trim()  ?? '',
        posko:          cells[8]?.textContent?.trim()  ?? '',
        nomorTelepon:   cells[9]?.textContent?.trim()  ?? '',
        deskripsi:      cells[10]?.textContent?.trim() ?? '',
        tanggalLapor:   cells[12]?.textContent?.trim() ?? '',
      }
    }),
  )

  // Nomor tiket APKT selalu diawali huruf kapital diikuti angka, misal G4426051100396
  const ticketPattern = /^[A-Z]\d{5,}$/
  return rows
    .filter((r) => ticketPattern.test(r.nomorLapor))
    .map((r) => ({ ...r, statusMapped: APKT_STATUS_MAP[r.status] ?? 'lapor', reguId: null }))
}

async function clickCari(page: Page) {
  // Tutup overlay/modal yang mungkin terbuka (misal dropdown "Cari menu" navbar)
  await page.keyboard.press('Escape')

  // Cari semua button berteks "Cari", skip yang rounded-full (itu navbar search)
  const allCari = page.locator('button').filter({ hasText: /^Cari$/ })
  const count = await allCari.count()

  for (let i = 0; i < count; i++) {
    const btn = allCari.nth(i)
    const cls = (await btn.getAttribute('class')) ?? ''
    if (cls.includes('rounded-full')) continue
    await btn.click()
    return
  }

  // Fallback: coba berdasarkan posisi — tombol Cari filter biasanya di kanan atas tabel
  const fallback = page.locator('button').filter({ hasText: /^Cari$/ }).last()
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click()
    return
  }

  throw new Error('Tombol "Cari" tidak ditemukan — periksa selector di scraper')
}

// ── Polling command helpers ───────────────────────────────────────────────────

// Tunggu command 'start_polling' dari app (dipakai di fase awal)
async function waitForCommand(
  expected: string,
  timeoutMs = 600_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const cmd = await getCommand()
    if (cmd === expected) { await consumeCommand(); return true }
    if (cmd === 'stop') { await consumeCommand(); return false }
    await new Promise((r) => setTimeout(r, COMMAND_POLL_MS))
  }
  return false
}

// Tunggu interval 5 menit — bisa di-interrupt oleh 'poll_now' atau 'stop'
// Return: 'poll' = lanjut scrape, 'stop' = berhenti
async function waitForNextPoll(): Promise<'poll' | 'stop'> {
  const deadline = Date.now() + POLL_INTERVAL_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, COMMAND_POLL_MS))
    const cmd = await getCommand()
    if (cmd === 'stop') { await consumeCommand(); return 'stop' }
    if (cmd === 'poll_now') { await consumeCommand(); return 'poll' }
  }
  return 'poll'
}

// ── Session helpers ───────────────────────────────────────────────────────────

function loadSession(): string | undefined {
  if (fs.existsSync(SESSION_FILE)) return SESSION_FILE
  return undefined
}

async function saveSession(context: BrowserContext) {
  await context.storageState({ path: SESSION_FILE })
  console.log('💾 Session disimpan —  login berikutnya otomatis')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 APKT Scraper dimulai')
  console.log(`   App URL : ${APP_URL}`)
  console.log(`   APKT URL: ${APKT_URL}`)

  const sessionExists = fs.existsSync(SESSION_FILE)
  console.log(`   Session : ${sessionExists ? '✅ ditemukan, coba auto-login' : '❌ belum ada, perlu login manual'}\n`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ storageState: loadSession() })
  const page = await context.newPage()

  async function shutdown(msg: string) {
    console.log(`\n${msg}`)
    await postStatus('idle')
    await browser.close().catch(() => {})
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('⛔ Dihentikan oleh user (Ctrl+C)'))

  // ── Fase 1: Login (skip jika session masih valid) ─────────────────────────
  await postStatus('waiting_login')
  console.log('📂 Membuka APKT...')
  await page.goto(APKT_URL, { waitUntil: 'domcontentloaded' })

  const isLoggedIn = page.url().includes('monitoring-all')
  if (isLoggedIn) {
    console.log('✅ Session valid — login dilewati!\n')
  } else {
    console.log('⏳ Silakan login ke APKT (timeout 10 menit)...')
    await page.waitForURL('**/monitoring-all', { timeout: 600_000 })
    console.log('✅ Login berhasil!')
    await saveSession(context)
    console.log()
  }

  // Log header kolom sekali untuk debugging
  const headers = await page
    .$$eval('table thead th', (ths) => ths.map((th) => th.textContent?.trim()))
    .catch(() => [])
  if (headers.length) console.log('   Kolom tabel:', headers.join(' | '), '\n')

  // ── Fase 2: Tunggu user siap (set filter + klik Cari) ─────────────────────
  await postStatus('waiting_search')
  await consumeCommand() // bersihkan command sisa sesi sebelumnya
  console.log('📋 Set filter di APKT, lalu klik Cari.')
  console.log('   Setelah siap, klik tombol "Mulai Polling" di monitoring app.\n')

  const started = await waitForCommand('start_polling')
  if (!started) return shutdown('⛔ Dihentikan sebelum mulai polling')

  console.log('▶️  Polling dimulai!')
  await postStatus('running')

  // Scrape segera (data dari Cari terakhir user)
  const initial = await scrapeTable(page)
  await postData(initial)
  console.log(`📊 Data awal: ${initial.length} laporan`)

  // ── Fase 3: Polling tiap 5 menit (bisa manual via tombol di app) ──────────
  let iteration = 1
  while (true) {
    const action = await waitForNextPoll()
    if (action === 'stop') return shutdown('⛔ Dihentikan dari monitoring app')

    const time = new Date().toLocaleTimeString('id-ID')
    console.log(`\n[${time}] 🔄 Polling #${iteration}...`)

    try {
      await clickCari(page)
      // Tunggu request AJAX selesai — jangan pakai waitForSelector karena
      // baris lama masih di DOM saat loading sehingga langsung resolve
      await page.waitForLoadState('networkidle', { timeout: 20_000 })

      const data = await scrapeTable(page)
      await postData(data)
      console.log(`   ✅ ${data.length} laporan dikirim`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ❌ Error: ${msg}`)
      await postStatus('error', msg)
    }

    iteration++
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  postStatus('error', String(err)).finally(() => process.exit(1))
})
