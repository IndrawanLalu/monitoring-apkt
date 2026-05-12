'use client'

import { useState, useEffect, useCallback } from 'react'
import { StatusBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { ApktState, ScraperStatus, AppStatus } from '@/lib/apkt/types'

const REFRESH_INTERVAL_MS = 3_000

interface Regu { id: string; nama: string }

// ── Status scraper ────────────────────────────────────────────────────────────

const SCRAPER_STATUS_CONFIG: Record<
  ScraperStatus,
  { label: string; color: string; animate: boolean }
> = {
  idle: { label: 'Scraper belum berjalan', color: '#9CA3AF', animate: false },
  waiting_login: { label: 'Menunggu login di browser APKT...', color: '#0070C0', animate: true },
  waiting_search: { label: 'Set filter di APKT, lalu klik Mulai Polling', color: '#F5A623', animate: true },
  running: { label: 'Aktif — refresh otomatis tiap 60 detik', color: '#1DB954', animate: false },
  error: { label: 'Error', color: '#E4002B', animate: false },
}

function ScraperStatusBanner({
  state, onStart, onStop, onPollNow, loading,
}: {
  state: ApktState
  onStart: () => void
  onStop: () => void
  onPollNow: () => void
  loading: boolean
}) {
  const cfg = SCRAPER_STATUS_CONFIG[state.scraperStatus]
  const lastSync = state.lastSync
    ? new Date(state.lastSync).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-2 border-neo-black bg-neo-white shadow-neo-sm">
      <span
        className={cn('inline-block w-3 h-3 rounded-full border border-neo-black shrink-0', cfg.animate && 'animate-pulse')}
        style={{ backgroundColor: cfg.color }}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-neo-black">{cfg.label}</span>
        {state.scraperStatus === 'error' && state.error && (
          <span className="ml-2 text-xs text-pln-red font-medium">{state.error}</span>
        )}
      </div>
      {state.scraperStatus === 'running' && (
        <div className="flex items-center gap-3 text-xs font-bold shrink-0">
          <span><span className="text-pln-blue">{state.totalRows}</span> laporan</span>
          {lastSync && <span className="text-gray-500">Sync: <span className="text-neo-black">{lastSync}</span></span>}
          <button
            onClick={onPollNow}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-bold text-neo-black border-2 border-neo-black shadow-neo-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-pln-yellow"
          >
            {loading ? '...' : '🔄 Ambil Sekarang'}
          </button>
        </div>
      )}
      {state.scraperStatus === 'waiting_search' && (
        <button
          onClick={onStart}
          disabled={loading}
          className="shrink-0 px-4 py-1.5 text-sm font-bold text-white border-2 border-neo-black shadow-neo-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#1DB954' }}
        >
          {loading ? '...' : '▶ Mulai Polling'}
        </button>
      )}
      {(state.scraperStatus === 'running' || state.scraperStatus === 'error') && (
        <button
          onClick={onStop}
          disabled={loading}
          className="shrink-0 px-4 py-1.5 text-sm font-bold text-white border-2 border-neo-black shadow-neo-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#E4002B' }}
        >
          {loading ? '...' : '⏹ Hentikan & Tutup Browser'}
        </button>
      )}
    </div>
  )
}

// ── Instruksi ─────────────────────────────────────────────────────────────────

function StartInstructions({ scraperStatus }: { scraperStatus: ScraperStatus }) {
  if (scraperStatus !== 'idle') return null
  return (
    <div className="border-2 border-pln-blue bg-blue-50 p-4 shadow-[2px_2px_0px_#003B8E]">
      <p className="text-sm font-bold text-pln-blue mb-2">Cara memulai scraper:</p>
      <ol className="text-xs text-neo-black space-y-1 list-decimal list-inside font-medium">
        <li>Buka terminal baru, jalankan: <code className="bg-neo-black text-pln-yellow px-2 py-0.5 font-mono">pnpm apkt</code></li>
        <li>Browser Chrome akan terbuka otomatis menuju APKT</li>
        <li>Login ke APKT (username, password, selesaikan CAPTCHA manual)</li>
        <li>Set filter di APKT, lalu klik tombol <strong>Cari</strong> sendiri</li>
        <li>Kembali ke halaman ini → klik <strong>Mulai Polling</strong></li>
        <li>Scraper refresh data otomatis setiap 60 detik</li>
      </ol>
    </div>
  )
}

// ── Badge status APKT ─────────────────────────────────────────────────────────

function ApktStatusBadge({ status, mapped }: { status: string; mapped: AppStatus }) {
  return (
    <div className="flex flex-col gap-0.5">
      <StatusBadge status={mapped} size="sm" showEmoji={false} />
      <span className="text-[10px] text-gray-500 leading-tight">{status}</span>
    </div>
  )
}

// ── Dropdown regu ─────────────────────────────────────────────────────────────

function ReguSelect({
  nomorLapor, reguId, reguList, onAssign,
}: {
  nomorLapor: string
  reguId: string | null
  reguList: Regu[]
  onAssign: (nomorLapor: string, reguId: string | null) => void
}) {
  return (
    <select
      value={reguId ?? ''}
      onChange={(e) => onAssign(nomorLapor, e.target.value || null)}
      className="text-xs font-bold border-2 border-neo-black bg-neo-white px-1 py-0.5 w-full focus:outline-none focus:border-pln-blue"
    >
      <option value="">— pilih —</option>
      {reguList.map((r) => (
        <option key={r.id} value={r.id}>{r.nama}</option>
      ))}
    </select>
  )
}

// ── Tabel ─────────────────────────────────────────────────────────────────────

function LaporanTable({
  data, reguList, onAssignRegu,
}: {
  data: ApktState['data']
  reguList: Regu[]
  onAssignRegu: (nomorLapor: string, reguId: string | null) => void
}) {
  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm font-bold">
        Belum ada data
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-pln-blue text-white sticky top-0 z-10">
            {['No.', 'No. Lapor', 'Nama Pelanggan', 'Status', 'Durasi',
              'Lokasi / Alamat', 'Posko', 'No. Telepon', 'Tanggal Lapor',
              'Deskripsi'].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-bold border-b-2 border-neo-black whitespace-nowrap text-xs">
                {h}
              </th>
            ))}
            <th
              className="px-3 py-2 text-left font-bold border-b-2 border-neo-black text-xs"
              style={{ minWidth: '200px', width: '200px' }}
            >
              Regu
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.nomorLapor || i}
              className={cn(
                'border-b border-neo-black/20 hover:bg-pln-yellow/10 transition-colors',
                i % 2 === 0 ? 'bg-neo-white' : 'bg-neo-gray/30',
              )}
            >
              <td className="px-3 py-2 text-xs text-gray-500 font-bold">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs font-bold text-pln-blue">{row.nomorLapor}</span>
              </td>
              <td className="px-3 py-2 font-bold text-xs whitespace-nowrap">{row.namaPelanggan}</td>
              <td className="px-3 py-2">
                <ApktStatusBadge status={row.status} mapped={row.statusMapped} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-center">{row.durasi}</td>
              <td className="px-3 py-2 text-xs max-w-45">
                <div className="font-medium">{row.lokasi || row.alamatPelapor}</div>
                {row.lokasi && row.alamatPelapor && row.lokasi !== row.alamatPelapor && (
                  <div className="text-gray-400 text-[10px] mt-0.5 truncate">{row.alamatPelapor}</div>
                )}
              </td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{row.posko}</td>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.nomorTelepon}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{row.tanggalLapor}</td>
              <td className="px-3 py-2 text-xs max-w-50">
                <span className="line-clamp-2 leading-tight">{row.deskripsi}</span>
              </td>
              <td className="px-3 py-2" style={{ minWidth: '200px', width: '200px' }}>
                <ReguSelect
                  nomorLapor={row.nomorLapor}
                  reguId={row.reguId}
                  reguList={reguList}
                  onAssign={onAssignRegu}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const EMPTY_STATE: ApktState = {
  scraperStatus: 'idle',
  lastSync: null,
  totalRows: 0,
  data: [],
  pendingCommand: null,
  reguAssignments: {},
}

export function ApktMonitorClient({ reguList }: { reguList: Regu[] }) {
  const [apktState, setApktState] = useState<ApktState>(EMPTY_STATE)
  const [cmdLoading, setCmdLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/apkt/data')
      if (res.ok) setApktState(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  async function sendCommand(command: 'start_polling' | 'stop' | 'poll_now') {
    setCmdLoading(true)
    await fetch('/api/apkt/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'command', command }),
    }).catch(() => {})
    await fetchData()
    setCmdLoading(false)
  }

  async function handleAssignRegu(nomorLapor: string, reguId: string | null) {
    const row = apktState.data.find((d) => d.nomorLapor === nomorLapor)
    const namaRegu = reguList.find((r) => r.id === reguId)?.nama ?? ''

    // Optimistic update lokal
    setApktState((prev) => ({
      ...prev,
      data: prev.data.map((d) => d.nomorLapor === nomorLapor ? { ...d, reguId } : d),
    }))

    // Simpan ke server + kirim WA
    await fetch('/api/apkt/assign-regu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomorLapor,
        reguId,
        namaRegu,
        namaPelanggan: row?.namaPelanggan ?? '',
        lokasi: row?.lokasi || row?.alamatPelapor || '',
        statusApkt: row?.status ?? '',
      }),
    }).catch(() => {})
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b-2 border-neo-black bg-neo-white shrink-0">
        <h1 className="text-lg font-black text-neo-black leading-none">Monitor APKT</h1>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">
          Data langsung dari APKT korporat — tidak disimpan ke database
        </p>
      </div>
      <div className="px-4 py-3 border-b-2 border-neo-black bg-neo-gray/30 shrink-0 space-y-3">
        <ScraperStatusBanner
          state={apktState}
          onStart={() => sendCommand('start_polling')}
          onStop={() => sendCommand('stop')}
          onPollNow={() => sendCommand('poll_now')}
          loading={cmdLoading}
        />
        <StartInstructions scraperStatus={apktState.scraperStatus} />
      </div>
      <LaporanTable
        data={apktState.data}
        reguList={reguList}
        onAssignRegu={handleAssignRegu}
      />
    </div>
  )
}
