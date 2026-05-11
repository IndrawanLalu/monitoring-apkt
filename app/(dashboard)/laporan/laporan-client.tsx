'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { STATUS_COLOR } from '@/constants'
import type { StatusLaporan } from '@/constants'
import { formatTanggal, formatShiftLabel } from '@/lib/utils/format'

export interface LaporanRekap {
  id: string
  status: StatusLaporan
  regu_id: string
  piket_id: string | null
}

export interface ReguItem {
  id: string
  nama: string
}

export interface PiketItem {
  id: string
  tanggal: string
  shift_type_id: string
  shift_type: { id: string; nama: string; jam_mulai: string; jam_selesai: string } | null
}

interface Props {
  tanggal: string
  laporanList: LaporanRekap[]
  reguList: ReguItem[]
  piketList: PiketItem[]
}

type StatusCounts = Record<StatusLaporan, number>

const STATUS_COLS: { key: StatusLaporan; label: string }[] = [
  { key: 'lapor', label: 'Lapor' },
  { key: 'ditangani', label: 'Proses' },
  { key: 'nyala_sementara', label: 'Hold' },
  { key: 'selesai', label: 'Selesai' },
]

function countStatus(list: LaporanRekap[]): StatusCounts {
  return {
    lapor: list.filter((l) => l.status === 'lapor').length,
    ditangani: list.filter((l) => l.status === 'ditangani').length,
    nyala_sementara: list.filter((l) => l.status === 'nyala_sementara').length,
    selesai: list.filter((l) => l.status === 'selesai').length,
  }
}

export function RekapClient({ tanggal, laporanList, reguList, piketList }: Props) {
  const router = useRouter()
  const [filterPiket, setFilterPiket] = useState('semua')
  const [filterRegu, setFilterRegu] = useState('semua')

  const filtered = useMemo(
    () =>
      laporanList.filter((l) => {
        if (filterPiket !== 'semua' && l.piket_id !== filterPiket) return false
        if (filterRegu !== 'semua' && l.regu_id !== filterRegu) return false
        return true
      }),
    [laporanList, filterPiket, filterRegu],
  )

  const totalCounts = useMemo(() => countStatus(filtered), [filtered])

  const reguRows = useMemo(
    () =>
      reguList
        .filter((r) => filterRegu === 'semua' || r.id === filterRegu)
        .map((r) => {
          const rl = filtered.filter((l) => l.regu_id === r.id)
          return { regu: r, counts: countStatus(rl), total: rl.length }
        }),
    [filtered, reguList, filterRegu],
  )

  const visiblePikets = useMemo(
    () => (filterPiket === 'semua' ? piketList : piketList.filter((p) => p.id === filterPiket)),
    [piketList, filterPiket],
  )

  const tanpaPiket = useMemo(() => filtered.filter((l) => l.piket_id === null), [filtered])

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return
    setFilterPiket('semua')
    setFilterRegu('semua')
    router.push(`?tanggal=${e.target.value}`)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b-2 border-neo-black bg-neo-white space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-neo-black uppercase tracking-wide">Rekap Laporan</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{formatTanggal(tanggal + 'T00:00:00')}</p>
          </div>
          <input
            type="date"
            value={tanggal}
            onChange={handleDateChange}
            className="neo-input px-3 py-1.5 text-sm font-bold"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterPiket}
            onChange={(e) => setFilterPiket(e.target.value)}
            className="neo-input px-3 py-1.5 text-sm"
          >
            <option value="semua">Semua Piket</option>
            {piketList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shift_type
                  ? formatShiftLabel(p.shift_type.nama, p.shift_type.jam_mulai, p.shift_type.jam_selesai)
                  : p.shift_type_id}
              </option>
            ))}
          </select>
          <select
            value={filterRegu}
            onChange={(e) => setFilterRegu(e.target.value)}
            className="neo-input px-3 py-1.5 text-sm"
          >
            <option value="semua">Semua Regu</option>
            {reguList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
              </option>
            ))}
          </select>
        </div>

        {/* Summary cards */}
        <div className="flex gap-2 flex-wrap">
          <SummaryCard label="Total" value={filtered.length} bg="#003B8E" fg="#FFFFFF" />
          {STATUS_COLS.map((s) => (
            <SummaryCard
              key={s.key}
              label={s.label}
              value={totalCounts[s.key]}
              bg={STATUS_COLOR[s.key].bg}
              fg={STATUS_COLOR[s.key].text}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 font-medium">
            Tidak ada laporan pada tanggal ini
          </div>
        ) : (
          <>
            {/* Per Regu */}
            <section>
              <h2 className="font-black text-sm uppercase tracking-wide text-neo-black mb-2">
                Rekap per Regu
              </h2>
              <ReguTable
                reguRows={reguRows}
                totalCounts={totalCounts}
                grandTotal={filtered.length}
              />
            </section>

            {/* Per Piket */}
            {visiblePikets.length > 0 && (
              <section>
                <h2 className="font-black text-sm uppercase tracking-wide text-neo-black mb-2">
                  Rekap per Piket
                </h2>
                <div className="space-y-4">
                  {visiblePikets.map((piket) => {
                    const piketLaporan = filtered.filter((l) => l.piket_id === piket.id)
                    const piketReguRows = reguList
                      .filter((r) => filterRegu === 'semua' || r.id === filterRegu)
                      .map((r) => {
                        const rl = piketLaporan.filter((l) => l.regu_id === r.id)
                        return { regu: r, counts: countStatus(rl), total: rl.length }
                      })
                      .filter((r) => r.total > 0)

                    const shiftLabel = piket.shift_type
                      ? formatShiftLabel(
                          piket.shift_type.nama,
                          piket.shift_type.jam_mulai,
                          piket.shift_type.jam_selesai,
                        )
                      : piket.shift_type_id

                    return (
                      <div
                        key={piket.id}
                        className="border-2 border-neo-black shadow-neo overflow-hidden"
                      >
                        <div
                          className="px-3 py-2 border-b-2 border-neo-black flex items-center justify-between"
                          style={{ backgroundColor: '#003B8E' }}
                        >
                          <span className="font-black text-sm text-white">{shiftLabel}</span>
                          <span className="text-xs text-blue-200 font-bold">
                            {piketLaporan.length} laporan
                          </span>
                        </div>
                        {piketReguRows.length === 0 ? (
                          <div className="px-3 py-5 text-center text-sm text-gray-400">
                            Tidak ada laporan
                          </div>
                        ) : (
                          <ReguTable
                            reguRows={piketReguRows}
                            totalCounts={countStatus(piketLaporan)}
                            grandTotal={piketLaporan.length}
                            compact
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Tanpa Piket */}
            {tanpaPiket.length > 0 && filterPiket === 'semua' && (
              <section>
                <h2 className="font-black text-sm uppercase tracking-wide text-neo-black mb-2">
                  Tanpa Piket
                </h2>
                <div className="border-2 border-neo-black shadow-neo overflow-hidden">
                  <div className="px-3 py-2 border-b-2 border-neo-black flex items-center justify-between bg-neo-gray">
                    <span className="font-black text-sm text-neo-black">Laporan tanpa piket</span>
                    <span className="text-xs text-gray-500 font-bold">{tanpaPiket.length} laporan</span>
                  </div>
                  <ReguTable
                    reguRows={reguList
                      .filter((r) => filterRegu === 'semua' || r.id === filterRegu)
                      .map((r) => {
                        const rl = tanpaPiket.filter((l) => l.regu_id === r.id)
                        return { regu: r, counts: countStatus(rl), total: rl.length }
                      })
                      .filter((r) => r.total > 0)}
                    totalCounts={countStatus(tanpaPiket)}
                    grandTotal={tanpaPiket.length}
                    compact
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

interface ReguRow {
  regu: ReguItem
  counts: StatusCounts
  total: number
}

function ReguTable({
  reguRows,
  totalCounts,
  grandTotal,
  compact = false,
}: {
  reguRows: ReguRow[]
  totalCounts: StatusCounts
  grandTotal: number
  compact?: boolean
}) {
  const px = compact ? 'px-3 py-1.5' : 'px-3 py-2'
  const showFooter = reguRows.length > 1

  return (
    <div className={compact ? '' : 'border-2 border-neo-black shadow-neo overflow-x-auto'}>
      <table className="w-full text-sm border-collapse">
        <thead className={compact ? 'bg-neo-gray' : 'bg-neo-black text-white'}>
          <tr>
            <th className={`text-left ${px} font-bold text-xs ${compact ? 'text-neo-black' : ''}`}>
              Regu
            </th>
            {STATUS_COLS.map((s) => (
              <th
                key={s.key}
                className={`text-center ${px} font-bold text-xs ${compact ? 'text-neo-black' : ''}`}
              >
                {s.label}
              </th>
            ))}
            <th
              className={`text-center ${px} font-bold text-xs ${compact ? 'text-neo-black' : ''}`}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neo-gray">
          {reguRows.map(({ regu, counts, total }) => (
            <tr key={regu.id} className="hover:bg-neo-gray/40 transition-colors">
              <td className={`${px} font-bold`}>{regu.nama}</td>
              {STATUS_COLS.map((s) => (
                <td key={s.key} className={`text-center ${px}`}>
                  {counts[s.key] > 0 ? (
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 font-black text-xs border border-neo-black"
                      style={{
                        backgroundColor: STATUS_COLOR[s.key].bg,
                        color: STATUS_COLOR[s.key].text,
                      }}
                    >
                      {counts[s.key]}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              ))}
              <td className={`text-center ${px} font-black`}>{total > 0 ? total : <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
        {showFooter && (
          <tfoot className="border-t-2 border-neo-black bg-neo-gray">
            <tr>
              <td className={`${px} font-black text-xs uppercase`}>Total</td>
              {STATUS_COLS.map((s) => (
                <td key={s.key} className={`text-center ${px} font-black text-xs`}>
                  {totalCounts[s.key] > 0 ? totalCounts[s.key] : '—'}
                </td>
              ))}
              <td className={`text-center ${px} font-black text-xs`}>{grandTotal}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  bg,
  fg,
}: {
  label: string
  value: number
  bg: string
  fg: string
}) {
  return (
    <div
      className="border-2 border-neo-black px-4 py-2 flex flex-col items-center min-w-16 shrink-0"
      style={{ backgroundColor: bg }}
    >
      <span className="text-2xl font-black leading-none" style={{ color: fg }}>
        {value}
      </span>
      <span className="text-xs font-bold mt-0.5" style={{ color: fg }}>
        {label}
      </span>
    </div>
  )
}
