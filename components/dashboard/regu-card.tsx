'use client'

import { useState, useEffect } from 'react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatWaktu } from '@/lib/utils/format'
import type { Laporan, ReguStats, StatusLaporan } from '@/types'

interface ReguCardProps {
  stats: ReguStats
  onAddLaporan: (reguId: string) => void
  onKirimWa: (reguId: string) => void
  onUpdateLaporan: (laporan: Laporan) => void
  sendingWa: boolean
}

type WarningLevel = 'none' | 'yellow' | 'red'

function getDurasiMenit(laporan: Laporan, now: number): number {
  // Untuk lapor: hitung dari created_at (belum ada tindakan)
  // Untuk ditangani/nyala_sementara: hitung dari updated_at (sejak status berubah)
  const base = laporan.status === 'lapor'
    ? new Date(laporan.created_at).getTime()
    : new Date(laporan.updated_at).getTime()
  return Math.floor((now - base) / 60000)
}

function getWarning(status: StatusLaporan, menit: number): WarningLevel {
  if (status === 'lapor') {
    if (menit >= 50) return 'red'
    if (menit >= 20) return 'yellow'
  } else if (status === 'ditangani' || status === 'nyala_sementara') {
    if (menit >= 60) return 'red'
    if (menit >= 40) return 'yellow'
  }
  return 'none'
}

function formatDurasi(menit: number): string {
  if (menit < 60) return `${menit}m`
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  return sisa > 0 ? `${jam}j ${sisa}m` : `${jam}j`
}

export function ReguCard({ stats, onAddLaporan, onKirimWa, onUpdateLaporan, sendingWa }: ReguCardProps) {
  const { regu, petugas, laporan, lapor, ditangani, nyala_sementara, selesai } = stats
  const [collapsed, setCollapsed] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Update setiap menit agar durasi dan warning selalu fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const aktivLaporan = laporan.filter((l) => l.status !== 'selesai')
  const namaPetugas = petugas.map((p) => p.nama).join(' & ') || '—'

  const headerColor = lapor > 0 ? '#E4002B' : ditangani > 0 ? '#0070C0' : nyala_sementara > 0 ? '#FFD200' : '#1DB954'
  const headerTextColor = nyala_sementara > 0 && lapor === 0 && ditangani === 0 ? '#1A1A1A' : '#FFFFFF'

  return (
    <div className="neo-card flex flex-col h-full">
      {/* Card Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b-2 border-neo-black cursor-pointer select-none"
        style={{ backgroundColor: headerColor, color: headerTextColor }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <div className="font-black text-sm leading-none">{regu.nama.toUpperCase()}</div>
          <div className="text-xs opacity-80 font-medium mt-0.5">{namaPetugas}</div>
        </div>
        <div className="text-right flex items-center gap-2">
          <div>
            <div className="font-black text-xl leading-none">{aktivLaporan.length}</div>
            <div className="text-xs opacity-80 font-medium">aktif</div>
          </div>
          <span className="text-xs opacity-60">{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-4 border-b-2 border-neo-black text-center">
        <MiniStat label="Lapor" value={lapor} color="#E4002B" />
        <MiniStat label="Proses" value={ditangani} color="#0070C0" />
        <MiniStat label="Hold" value={nyala_sementara} color="#FFD200" textColor="#1A1A1A" />
        <MiniStat label="Selesai" value={selesai} color="#1DB954" />
      </div>

      {/* Laporan list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto divide-y divide-neo-gray">
          {aktivLaporan.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400 font-medium">
              Tidak ada laporan aktif
            </div>
          ) : (
            aktivLaporan.map((l) => {
              const menit = getDurasiMenit(l, now)
              const warning = getWarning(l.status, menit)
              return (
                <div
                  key={l.id}
                  className={`px-3 py-2 cursor-pointer transition-colors border-l-4 ${
                    warning === 'red'
                      ? 'border-l-pln-red bg-pln-red/5 hover:bg-pln-red/10'
                      : warning === 'yellow'
                      ? 'border-l-pln-yellow bg-pln-yellow/5 hover:bg-pln-yellow/10'
                      : 'border-l-transparent hover:bg-pln-blue/5'
                  }`}
                  onClick={() => onUpdateLaporan(l)}
                  title="Klik untuk update status"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-neo-black truncate">
                        #{l.nomor_tiket}
                      </div>
                      <div className="text-xs text-gray-600 truncate font-medium">{l.nama_pelanggan}</div>
                      <div className="text-xs text-gray-500 truncate">{l.lokasi}</div>
                      {l.keterangan && (
                        <div className="text-xs text-gray-400 italic truncate mt-0.5">
                          {l.keterangan}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={l.status} showEmoji={false} size="sm" />
                      <span className="text-xs text-gray-400 font-mono">
                        {formatWaktu(l.created_at)}
                      </span>
                      {/* Durasi + warning */}
                      <span
                        className={`text-xs font-bold font-mono ${
                          warning === 'red'
                            ? 'text-pln-red'
                            : warning === 'yellow'
                            ? 'text-pln-orange'
                            : 'text-gray-400'
                        }`}
                      >
                        {warning !== 'none' && (warning === 'red' ? '🔴 ' : '🟡 ')}
                        {formatDurasi(menit)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-2 border-t-2 border-neo-black flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => onAddLaporan(regu.id)}
        >
          + Laporan
        </Button>
        <Button
          variant="yellow"
          size="sm"
          className="flex-1 text-xs"
          loading={sendingWa}
          onClick={() => onKirimWa(regu.id)}
          title="Kirim semua laporan aktif regu ini ke WA grup"
        >
          📤 WA
        </Button>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  color,
  textColor = '#FFFFFF',
}: {
  label: string
  value: number
  color: string
  textColor?: string
}) {
  return (
    <div className="py-1.5 border-r last:border-r-0 border-neo-gray">
      <div className="font-black text-sm" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-gray-400 font-medium leading-none">{label}</div>
    </div>
  )
}
