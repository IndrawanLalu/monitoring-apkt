'use client'

import { useState, useEffect } from 'react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatWaktu } from '@/lib/utils/format'
import type { Laporan, ReguStats, StatusLaporan } from '@/types'

interface ReguCardProps {
  stats: ReguStats
  onKirimWa: (reguId: string) => void
  onUpdateLaporan: (laporan: Laporan) => void
  onPindahLaporan: (laporan: Laporan) => void
  onTambahLaporan: (reguId: string) => void
  sendingWa: boolean
}

type WarningLevel = 'none' | 'yellow' | 'red'

function getDurasiMenit(laporan: Laporan, now: number): number {
  return Math.max(0, Math.floor((now - new Date(laporan.created_at).getTime()) / 60000))
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

function getHeaderColors(lapor: number, penugasan_regu: number, ditangani: number, nyala_sementara: number): { bg: string; text: string; glow: string } {
  if (lapor > 0)            return { bg: '#E4002B', text: '#fff', glow: 'rgba(228,0,43,0.3)' }
  if (penugasan_regu > 0)   return { bg: '#F5A623', text: '#fff', glow: 'rgba(245,166,35,0.3)' }
  if (ditangani > 0)        return { bg: '#0070C0', text: '#fff', glow: 'rgba(0,112,192,0.3)' }
  if (nyala_sementara > 0)  return { bg: '#F5A623', text: '#fff', glow: 'rgba(245,166,35,0.3)' }
  return { bg: '#1DB954', text: '#fff', glow: 'rgba(29,185,84,0.3)' }
}

export function ReguCard({ stats, onKirimWa, onUpdateLaporan, onPindahLaporan, onTambahLaporan, sendingWa }: ReguCardProps) {
  const { regu, petugas, laporan, lapor, penugasan_regu, ditangani, nyala_sementara, selesai } = stats
  const [collapsed, setCollapsed] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const aktivLaporan = laporan
    .filter((l) => l.status !== 'selesai')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const antrian = lapor + penugasan_regu + nyala_sementara
  const namaPetugas = petugas.map((p) => p.nama).join(' & ') || '—'
  const { bg: headerBg, text: headerText, glow: headerGlow } = getHeaderColors(lapor, penugasan_regu, ditangani, nyala_sementara)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: `linear-gradient(135deg, ${headerBg} 0%, ${headerBg}CC 100%)`,
          boxShadow: `0 2px 8px ${headerGlow}`,
          cursor: 'pointer',
          userSelect: 'none',
          color: headerText,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.02em', lineHeight: 1 }}>
            {regu.nama.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>
            {namaPetugas}
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{aktivLaporan.length}</div>
            <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 400 }}>aktif</div>
          </div>
          <span style={{ fontSize: 10, opacity: 0.6 }}>{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {/* Mini Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <MiniStat label="Antrian" value={antrian} color="#E4002B" />
        <MiniStat label="Sedang Ditangani" value={ditangani} color="#0070C0" />
        <MiniStat label="Selesai" value={selesai} color="#1DB954" />
      </div>

      {/* Laporan List */}
      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {aktivLaporan.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              Tidak ada laporan aktif
            </div>
          ) : (
            aktivLaporan.map((l) => {
              const menit = getDurasiMenit(l, now)
              const warning = getWarning(l.status, menit)
              const warningBorder = warning === 'red' ? '#E4002B' : warning === 'yellow' ? '#F5A623' : 'transparent'
              const warningBg = warning === 'red' ? 'rgba(228,0,43,0.05)' : warning === 'yellow' ? 'rgba(245,166,35,0.05)' : 'transparent'

              return (
                <div
                  key={l.id}
                  onClick={() => onUpdateLaporan(l)}
                  title="Klik untuk update status"
                  style={{
                    padding: '9px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${warningBorder}`,
                    backgroundColor: warningBg,
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = warningBg)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{l.nomor_tiket}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {l.nama_pelanggan}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.lokasi}
                      </div>
                      {l.keterangan && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                          {l.keterangan}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <StatusBadge status={l.status} showEmoji={false} size="sm" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {formatWaktu(l.created_at)}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: warning === 'red' ? '#E4002B' : warning === 'yellow' ? '#F5A623' : 'var(--text-muted)',
                      }}>
                        {warning !== 'none' && (warning === 'red' ? '🔴 ' : '🟡 ')}
                        {formatDurasi(menit)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onPindahLaporan(l) }}
                        title="Pindahkan ke regu/ULP lain"
                        style={{ fontSize: 10, color: '#fff', background: '#0070C0', border: '1px solid #0070C0', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', lineHeight: '16px', fontWeight: 600 }}
                      >
                        ↗ Pindah
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface-2)',
          display: 'flex',
          gap: 6,
        }}
      >
        <Button
          variant="primary"
          size="sm"
          style={{ fontSize: 12, flexShrink: 0, backgroundColor: '#E4002B', borderColor: '#E4002B' }}
          onClick={() => onTambahLaporan(regu.id)}
        >
          ＋ Laporan
        </Button>
        <Button
          variant="yellow"
          size="sm"
          style={{ flex: 1, fontSize: 12 }}
          loading={sendingWa}
          onClick={() => onKirimWa(regu.id)}
        >
          📤 Kirim ke WA Group
        </Button>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: '6px 4px',
        borderRight: '1px solid var(--border)',
        textAlign: 'center',
      }}
      className="last:border-r-0"
    >
      <div style={{ fontWeight: 800, fontSize: 15, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  )
}
