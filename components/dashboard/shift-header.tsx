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
    <div
      style={{
        background: 'linear-gradient(135deg, #003B8E 0%, #005BB5 50%, #0070C0 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <div>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: 0, lineHeight: 1, letterSpacing: '-0.01em' }}>
              MONITORING APKT
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: '3px 0 0', fontWeight: 400 }}>
              {piket.ulp.nama}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{ color: '#fff', fontWeight: 800, fontSize: 24, fontFamily: 'monospace', lineHeight: 1 }}
            suppressHydrationWarning
          >
            {waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 3 }}>
            {formatTanggal(piket.tanggal)}
          </div>
        </div>
      </div>

      {/* Shift info + stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '3px 12px',
              fontWeight: 700,
              fontSize: 12,
              borderRadius: 6,
              backgroundColor: '#FFD200',
              color: '#0F172A',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {SHIFT_LABEL[shift.nama as ShiftType]}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500 }}>
            {jamMulai} – {jamSelesai}
          </span>
          {piket.nama_cc && (
            <span
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 11,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 5,
                padding: '2px 8px',
              }}
            >
              👤 CC: {piket.nama_cc}
            </span>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <StatChip label="Lapor"  value={totalLapor}         color="#E4002B" />
          <StatChip label="Proses" value={totalDitangani}     color="#3B9EFF" />
          <StatChip label="Hold"   value={totalNyalaSementara} color="#F5A623" />
          <StatChip label="Selesai" value={totalSelesai}      color="#1DB954" />
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff',
      }}
    >
      <span style={{ color }}>{value}</span>
      <span style={{ opacity: 0.75, fontSize: 10 }}>{label}</span>
    </div>
  )
}
