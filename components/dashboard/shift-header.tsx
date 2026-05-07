'use client'

import { useEffect, useState } from 'react'
import { SHIFT_LABEL, SHIFT_JAM } from '@/constants'
import type { ShiftType, Piket, Ulp } from '@/types'
import { formatTanggal } from '@/lib/utils/format'

interface ShiftHeaderProps {
  piket: Piket & { shift_type: { nama: ShiftType; jam_mulai: string; jam_selesai: string }; ulp: Ulp }
  totalLapor: number
  totalDitangani: number
  totalNyalaSementara: number
  totalSelesai: number
}

export function ShiftHeader({ piket, totalLapor, totalDitangani, totalNyalaSementara, totalSelesai }: ShiftHeaderProps) {
  const [waktu, setWaktu] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setWaktu(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const shift = piket.shift_type
  const jamMulai = SHIFT_JAM[shift.nama as ShiftType].mulai
  const jamSelesai = SHIFT_JAM[shift.nama as ShiftType].selesai

  return (
    <div className="neo-border-thick border-b-0" style={{ backgroundColor: '#003B8E' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-white/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="text-white font-black text-lg leading-none">MONITORING APKT</h1>
            <p className="text-blue-200 text-xs font-medium">{piket.ulp.nama}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-white font-black text-2xl font-mono leading-none" suppressHydrationWarning>
            {waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-blue-200 text-xs font-medium">{formatTanggal(piket.tanggal)}</div>
        </div>
      </div>

      {/* Shift info + stats */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-3 py-1 font-black text-sm border-2 border-white"
            style={{ backgroundColor: '#FFD200', color: '#1A1A1A' }}
          >
            {SHIFT_LABEL[shift.nama as ShiftType].toUpperCase()}
          </span>
          <span className="text-blue-100 text-sm font-medium">{jamMulai} – {jamSelesai}</span>
          {piket.nama_cc && (
            <span className="text-blue-100 text-xs font-medium border border-white/30 px-2 py-0.5">
              👤 CC: {piket.nama_cc}
            </span>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-1">
          <StatChip label="Lapor" value={totalLapor} color="#E4002B" textColor="#fff" />
          <StatChip label="Proses" value={totalDitangani} color="#0070C0" textColor="#fff" />
          <StatChip label="Hold" value={totalNyalaSementara} color="#FFD200" textColor="#1A1A1A" />
          <StatChip label="Selesai" value={totalSelesai} color="#1DB954" textColor="#fff" />
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, color, textColor }: { label: string; value: number; color: string; textColor: string }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 border border-white/30 text-xs font-bold"
      style={{ backgroundColor: color, color: textColor }}
    >
      <span>{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  )
}
