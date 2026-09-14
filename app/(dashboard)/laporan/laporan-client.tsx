'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABEL, STATUS_COLOR, SHIFT_LABEL } from '@/constants'
import type { StatusLaporan, ShiftType } from '@/types'

interface LaporanRow {
  id: string
  nomor_tiket: string
  nama_pelanggan: string
  lokasi: string
  status: StatusLaporan
  keterangan: string | null
  nama_cc_callback?: string | null
  tanggal_callback?: string | null
  status_callback?: string | null
  created_at: string
  updated_at: string
  regu: { nama: string } | null
}

interface Filters {
  mode: 'menggantung' | 'tanggal'
  tanggal: string
  shift_id?: string
  regu_id?: string
  status?: string
}

interface Props {
  initialLaporan: LaporanRow[]
  ulps: { id: string; nama: string }[]
  activeUlpId: string
  reguList: { id: string; nama: string }[]
  shiftTypes: { id: string; nama: ShiftType }[]
  initialFilters: Filters
}

/**
 * Ambang peringatan umur laporan — disamakan dengan kartu regu di dashboard.
 * Kelak sebaiknya diatur dari halaman Pengaturan, bukan angka tetap di dua tempat.
 */
const AMBANG_KUNING_MENIT = 30
const AMBANG_MERAH_MENIT = 120

function fmtWaktu(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function umurMenit(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

function fmtUmur(menit: number) {
  if (menit < 60) return `${menit}m`
  const jam = Math.floor(menit / 60)
  if (jam < 24) {
    const sisa = menit % 60
    return sisa > 0 ? `${jam}j ${sisa}m` : `${jam}j`
  }
  const hari = Math.floor(jam / 24)
  const sisaJam = jam % 24
  return sisaJam > 0 ? `${hari}h ${sisaJam}j` : `${hari}h`
}

function warnaUmur(menit: number) {
  if (menit >= AMBANG_MERAH_MENIT) return '#E4002B'
  if (menit >= AMBANG_KUNING_MENIT) return '#F5A623'
  return 'var(--text-muted)'
}

// Gaya kendali dipakai berulang. Memakai variabel tema supaya terbaca di mode
// terang maupun gelap — kelas `neo-input` yang dipakai sebelumnya tidak pernah
// didefinisikan di CSS mana pun, jadi dropdown-nya tampil dengan gaya bawaan
// browser dan nyaris tak terbaca di mode gelap.
const gayaKendali: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  fontWeight: 600,
  minWidth: 130,
}

const gayaLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 3,
  display: 'block',
}

export function LaporanClient({
  initialLaporan, ulps, activeUlpId, reguList, shiftTypes, initialFilters,
}: Props) {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  // Date.now() tidak boleh dipanggil saat render — hasilnya berubah tiap render
  // dan React menganggapnya tidak murni. Diambil sekali di state, lalu didetakkan
  // tiap menit supaya kolom Umur ikut berjalan tanpa perlu reload.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  function buka(next: Partial<Filters & { ulp_id: string }>) {
    const f = { ...filters, ...next }
    const params = new URLSearchParams()
    params.set('ulp_id', (next.ulp_id as string) ?? activeUlpId)
    if (f.mode === 'tanggal') {
      params.set('mode', 'tanggal')
      params.set('tanggal', f.tanggal)
      if (f.shift_id) params.set('shift_id', f.shift_id)
    }
    if (f.regu_id) params.set('regu_id', f.regu_id)
    if (f.status) params.set('status', f.status)
    router.push(`/laporan?${params.toString()}`)
  }

  const statusCount = initialLaporan.reduce<Record<StatusLaporan, number>>(
    (acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc },
    { lapor: 0, penugasan_regu: 0, ditangani: 0, nyala_sementara: 0, selesai: 0 },
  )

  const modeMenggantung = filters.mode === 'menggantung'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div
        className="shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface-2)',
          padding: '10px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* ── Pemilih ULP (hanya kalau punya lebih dari satu) ── */}
        {ulps.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...gayaLabel, marginBottom: 0, marginRight: 2 }}>ULP</span>
            {ulps.map((u) => {
              const aktif = u.id === activeUlpId
              return (
                <button
                  key={u.id}
                  onClick={() => buka({ ulp_id: u.id })}
                  style={{
                    padding: '4px 11px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    cursor: 'pointer',
                    border: `1px solid ${aktif ? '#0070C0' : 'var(--border-strong)'}`,
                    backgroundColor: aktif ? '#0070C0' : 'var(--bg-surface)',
                    color: aktif ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {u.nama}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Mode + filter ── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <span style={gayaLabel}>Tampilkan</span>
            <div style={{ display: 'flex', gap: 0 }}>
              {([
                ['menggantung', 'Masih menggantung'],
                ['tanggal', 'Per tanggal'],
              ] as const).map(([nilai, label], i) => {
                const aktif = filters.mode === nilai
                return (
                  <button
                    key={nilai}
                    onClick={() => { setFilters((f) => ({ ...f, mode: nilai })); buka({ mode: nilai }) }}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--border-strong)',
                      borderLeftWidth: i === 0 ? 1 : 0,
                      borderRadius: i === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
                      backgroundColor: aktif ? '#0070C0' : 'var(--bg-surface)',
                      color: aktif ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {filters.mode === 'tanggal' && (
            <>
              <div>
                <label style={gayaLabel} htmlFor="f-tanggal">Tanggal</label>
                <input
                  id="f-tanggal"
                  type="date"
                  value={filters.tanggal}
                  onChange={(e) => { const v = e.target.value; setFilters((f) => ({ ...f, tanggal: v })); buka({ tanggal: v }) }}
                  style={gayaKendali}
                />
              </div>
              <div>
                <label style={gayaLabel} htmlFor="f-shift">Shift</label>
                <select
                  id="f-shift"
                  value={filters.shift_id ?? ''}
                  onChange={(e) => { const v = e.target.value || undefined; setFilters((f) => ({ ...f, shift_id: v })); buka({ shift_id: v }) }}
                  style={gayaKendali}
                >
                  <option value="">Semua shift</option>
                  {shiftTypes.map((s) => (
                    <option key={s.id} value={s.id}>{SHIFT_LABEL[s.nama] ?? s.nama}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label style={gayaLabel} htmlFor="f-regu">Regu</label>
            <select
              id="f-regu"
              value={filters.regu_id ?? ''}
              onChange={(e) => { const v = e.target.value || undefined; setFilters((f) => ({ ...f, regu_id: v })); buka({ regu_id: v }) }}
              style={gayaKendali}
            >
              <option value="">Semua regu</option>
              {reguList.map((r) => (
                <option key={r.id} value={r.id}>{r.nama}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={gayaLabel} htmlFor="f-status">Status</label>
            <select
              id="f-status"
              value={filters.status ?? ''}
              onChange={(e) => { const v = e.target.value || undefined; setFilters((f) => ({ ...f, status: v })); buka({ status: v }) }}
              style={gayaKendali}
            >
              <option value="">Semua status</option>
              {(Object.keys(STATUS_LABEL) as StatusLaporan[])
                .filter((st) => !(modeMenggantung && st === 'selesai'))
                .map((st) => (
                  <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                ))}
            </select>
          </div>

          {/* ── Ringkasan ── */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
            {(Object.entries(statusCount) as [StatusLaporan, number][])
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <span
                  key={status}
                  style={{
                    padding: '3px 8px', fontSize: 11, fontWeight: 800, borderRadius: 4,
                    backgroundColor: STATUS_COLOR[status].bg, color: STATUS_COLOR[status].text,
                  }}
                >
                  {count} {STATUS_LABEL[status].split(' ')[0]}
                </span>
              ))}
            <span
              style={{
                padding: '3px 8px', fontSize: 11, fontWeight: 800, borderRadius: 4,
                backgroundColor: 'var(--bg-surface-3)', color: 'var(--text-primary)',
              }}
            >
              {initialLaporan.length} total
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabel ── */}
      <div className="flex-1 overflow-y-auto">
        {initialLaporan.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            {modeMenggantung
              ? 'Tidak ada laporan yang menggantung di ULP ini. Semuanya sudah selesai.'
              : 'Tidak ada laporan pada filter ini'}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neo-black text-white">
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide">No. Tiket</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide">Pelanggan</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden md:table-cell">Lokasi</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide">Regu</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide">Status</th>
                {modeMenggantung && (
                  <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide">Umur</th>
                )}
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden lg:table-cell">Keterangan</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden xl:table-cell">CC Callback</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden xl:table-cell">Status CC</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden xl:table-cell">Tgl CC</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Lapor</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Update</th>
              </tr>
            </thead>
            <tbody>
              {initialLaporan.map((l) => {
                const menit = umurMenit(l.created_at, now)
                return (
                  <tr key={l.id} className="border-b border-neo-gray hover:bg-neo-gray/30 transition-colors">
                    <td className="px-3 py-2 font-mono font-bold text-xs text-pln-blue">{l.nomor_tiket}</td>
                    <td className="px-3 py-2 font-medium">{l.nama_pelanggan}</td>
                    <td className="px-3 py-2 text-gray-600 hidden md:table-cell max-w-48 truncate">{l.lokasi}</td>
                    <td className="px-3 py-2 font-medium">{l.regu?.nama ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 text-xs font-black border border-current whitespace-nowrap"
                        style={{ backgroundColor: STATUS_COLOR[l.status].bg, color: STATUS_COLOR[l.status].text }}
                      >
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    {modeMenggantung && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: warnaUmur(menit) }}>
                          {menit >= AMBANG_MERAH_MENIT ? '🔴 ' : menit >= AMBANG_KUNING_MENIT ? '🟡 ' : ''}
                          {fmtUmur(menit)}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs text-gray-500 hidden lg:table-cell max-w-48 truncate">
                      {l.keterangan ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-neo-black font-medium hidden xl:table-cell whitespace-nowrap">
                      {l.nama_cc_callback ?? '—'}
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell whitespace-nowrap">
                      {l.status_callback ? (
                        <span className={`px-2 py-0.5 font-bold text-[10px] border border-current uppercase ${
                          l.status_callback === 'Nyala' ? 'text-[#1DB954] border-[#1DB954] bg-[#1DB954]/10' : 'text-[#F5A623] border-[#F5A623] bg-[#F5A623]/10'
                        }`}>
                          {l.status_callback}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden xl:table-cell whitespace-nowrap">
                      {l.tanggal_callback ? fmtWaktu(l.tanggal_callback) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">{fmtWaktu(l.created_at)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">{fmtWaktu(l.updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
