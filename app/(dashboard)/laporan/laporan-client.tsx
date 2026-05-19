'use client'

import { useState } from 'react'
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
  tanggal: string
  shift_id?: string
  regu_id?: string
}

interface Props {
  initialLaporan: LaporanRow[]
  reguList: { id: string; nama: string }[]
  shiftTypes: { id: string; nama: ShiftType }[]
  initialFilters: Filters
}

function fmtWaktu(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function LaporanClient({ initialLaporan, reguList, shiftTypes, initialFilters }: Props) {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>(initialFilters)

  function applyFilter() {
    const params = new URLSearchParams()
    params.set('tanggal', filters.tanggal)
    if (filters.shift_id) params.set('shift_id', filters.shift_id)
    if (filters.regu_id) params.set('regu_id', filters.regu_id)
    router.push(`/laporan?${params.toString()}`)
  }

  const statusCount = initialLaporan.reduce<Record<StatusLaporan, number>>(
    (acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc },
    { lapor: 0, penugasan_regu: 0, ditangani: 0, nyala_sementara: 0, selesai: 0 },
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 border-b-2 border-neo-black bg-neo-white px-4 py-3 flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={filters.tanggal}
          onChange={(e) => setFilters((f) => ({ ...f, tanggal: e.target.value }))}
          className="neo-input px-2 py-1.5 text-sm font-medium"
        />
        <select
          value={filters.shift_id ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, shift_id: e.target.value || undefined }))}
          className="neo-input px-2 py-1.5 text-sm font-medium"
        >
          <option value="">Semua Shift</option>
          {shiftTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {SHIFT_LABEL[s.nama] ?? s.nama}
            </option>
          ))}
        </select>
        <select
          value={filters.regu_id ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, regu_id: e.target.value || undefined }))}
          className="neo-input px-2 py-1.5 text-sm font-medium"
        >
          <option value="">Semua Regu</option>
          {reguList.map((r) => (
            <option key={r.id} value={r.id}>{r.nama}</option>
          ))}
        </select>
        <button
          onClick={applyFilter}
          className="px-4 py-1.5 text-sm font-black border-2 border-neo-black bg-pln-yellow text-neo-black shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
        >
          Filter
        </button>

        {/* Summary chips */}
        <div className="flex gap-1.5 ml-auto">
          {(Object.entries(statusCount) as [StatusLaporan, number][]).map(([status, count]) => (
            <div
              key={status}
              className="px-2 py-0.5 text-xs font-black border-2 border-neo-black"
              style={{ backgroundColor: STATUS_COLOR[status].bg, color: STATUS_COLOR[status].text }}
            >
              {count} {STATUS_LABEL[status].split(' ')[0]}
            </div>
          ))}
          <div className="px-2 py-0.5 text-xs font-black border-2 border-neo-black bg-neo-gray text-neo-black">
            {initialLaporan.length} Total
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {initialLaporan.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400 font-medium">
            Tidak ada laporan pada filter ini
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
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden lg:table-cell">Keterangan</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden xl:table-cell">CC Callback</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden xl:table-cell">Status CC</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden xl:table-cell">Tgl CC</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Lapor</th>
                <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Update</th>
              </tr>
            </thead>
            <tbody>
              {initialLaporan.map((l) => (
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
