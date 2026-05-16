'use client'

import { useState } from 'react'
import type { StatusLaporan } from '@/types'

type StatusCount = Record<StatusLaporan, number>

export interface ReguSummary {
  id: string
  nama: string
  petugas: string[]
  stats: StatusCount
  total: number
}

export interface UlpSummary {
  id: string
  nama: string
  stats: StatusCount
  total: number
  regus: ReguSummary[]
}

export interface RekapData {
  total: StatusCount
  totalLaporan: number
  ulps: UlpSummary[]
  tanggal: string
  callback: {
    total: number
    statusCount: Record<string, number>
  }
}

const STATUS_CONFIG: Record<StatusLaporan, { label: string; color: string; bg: string; icon: string }> = {
  lapor:           { label: 'Lapor',           color: '#92400E', bg: '#FEF3C7', icon: '📋' },
  ditangani:       { label: 'Ditangani',       color: '#1E40AF', bg: '#DBEAFE', icon: '🔧' },
  nyala_sementara: { label: 'Nyala Sementara', color: '#7C3AED', bg: '#EDE9FE', icon: '💡' },
  selesai:         { label: 'Selesai',         color: '#065F46', bg: '#D1FAE5', icon: '✅' },
}

const STATUS_ORDER: StatusLaporan[] = ['lapor', 'ditangani', 'nyala_sementara', 'selesai']

function StatBadge({ status, count }: { status: StatusLaporan; count: number }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '8px 12px', borderRadius: 10, backgroundColor: cfg.bg,
      border: `1.5px solid ${cfg.color}22`, minWidth: 64, flex: 1,
    }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3, textAlign: 'center' }}>
        {cfg.icon} {cfg.label}
      </span>
    </div>
  )
}

function MiniBar({ stats, total }: { stats: StatusCount; total: number }) {
  if (total === 0) return <div style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }} />
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
      {STATUS_ORDER.map(s => stats[s] > 0 && (
        <div key={s} style={{
          width: `${(stats[s] / total) * 100}%`,
          backgroundColor: STATUS_CONFIG[s].color,
        }} />
      ))}
    </div>
  )
}

function StatusChips({ stats, total }: { stats: StatusCount; total: number }) {
  if (total === 0) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#6B7280',
        backgroundColor: '#F3F4F6', borderRadius: 6, padding: '2px 8px',
        border: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>NIHIL</span>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {STATUS_ORDER.map(s => stats[s] > 0 && (
        <span key={s} style={{
          fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
          backgroundColor: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color,
          border: `1px solid ${STATUS_CONFIG[s].color}44`,
        }}>
          {stats[s]} {STATUS_CONFIG[s].label}
        </span>
      ))}
      <span style={{
        fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '2px 8px',
        backgroundColor: '#1F2937', color: '#fff',
      }}>{total} Total</span>
    </div>
  )
}

export function RekapClient({ data }: { data: RekapData }) {
  const [expandedUlp, setExpandedUlp] = useState<Record<string, boolean>>(
    data.ulps.reduce((acc, ulp) => ({ ...acc, [ulp.id]: ulp.total > 0 }), {})
  )
  const toggleUlp = (id: string) => setExpandedUlp(prev => ({ ...prev, [id]: !prev[id] }))

  const hasActive = data.total.lapor + data.total.ditangani + data.total.nyala_sementara > 0

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F1F5F9', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'linear-gradient(135deg, #003B8E 0%, #0055B3 100%)',
        boxShadow: '0 4px 20px rgba(0,59,142,0.3)',
      }}>
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
                  Rekap Gangguan
                </h1>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0', fontWeight: 500 }}>
                PLN — Monitoring APKT
              </p>
            </div>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
              padding: '6px 12px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tanggal</p>
              <p style={{ fontSize: 13, color: '#fff', margin: 0, fontWeight: 800 }}>{data.tanggal}</p>
            </div>
          </div>

          {/* Keterangan data */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '8px 12px', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#FCD34D', flexShrink: 0, display: 'block' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                Lapor / Ditangani / Nyala Sementara — Semua Waktu
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#34D399', flexShrink: 0, display: 'block' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                Selesai — Hari Ini Saja
              </span>
            </div>
          </div>
        </div>

        {/* Stat Boxes */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
          {STATUS_ORDER.map(s => (
            <StatBadge key={s} status={s} count={data.total[s]} />
          ))}
        </div>

        {/* Total bar */}
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.25)', padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Total Gangguan
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#FCD34D' }}>{data.totalLaporan}</span>
        </div>

        {/* Callback Row */}
        {data.callback.total > 0 && (
          <div style={{
            backgroundColor: '#1D4ED8', padding: '10px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                CC Call Back Hari Ini
              </p>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>{data.callback.total} Laporan</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(data.callback.statusCount).map(([k, v]) => (
                <span key={k} style={{
                  fontSize: 10, fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#fff', padding: '3px 10px', borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.3)',
                }}>
                  {v} {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alert: ada gangguan aktif */}
      {hasActive && (
        <div style={{
          margin: '12px 16px 0',
          backgroundColor: '#FEF3C7', border: '1.5px solid #F59E0B',
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#92400E', margin: 0 }}>Ada Gangguan Belum Selesai</p>
            <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>
              {data.total.lapor + data.total.ditangani + data.total.nyala_sementara} gangguan masih dalam proses penanganan
            </p>
          </div>
        </div>
      )}

      {/* ULP List */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>
        {data.ulps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600 }}>
            Belum ada data ULP.
          </div>
        ) : (
          data.ulps.map(ulp => {
            const isExpanded = expandedUlp[ulp.id]
            const isNihil = ulp.total === 0
            const hasUrgent = ulp.stats.lapor + ulp.stats.ditangani + ulp.stats.nyala_sementara > 0

            return (
              <div key={ulp.id} style={{
                backgroundColor: '#fff', borderRadius: 14,
                overflow: 'hidden',
                boxShadow: hasUrgent
                  ? '0 0 0 2px #F59E0B, 0 4px 16px rgba(0,0,0,0.08)'
                  : '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                {/* ULP Header */}
                <button
                  onClick={() => toggleUlp(ulp.id)}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', gap: 12,
                    background: isNihil
                      ? 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)'
                      : 'linear-gradient(135deg, #003B8E 0%, #0055B3 100%)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{
                      fontSize: 15, fontWeight: 800, margin: 0,
                      color: isNihil ? '#374151' : '#fff',
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                    }}>
                      {ulp.nama}
                    </h2>
                    <div style={{ marginTop: 6 }}>
                      <StatusChips stats={ulp.stats} total={ulp.total} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 18, fontWeight: 800,
                    color: isNihil ? '#9CA3AF' : 'rgba(255,255,255,0.8)',
                    flexShrink: 0,
                  }}>
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {/* Progress bar */}
                <MiniBar stats={ulp.stats} total={ulp.total} />

                {/* Regu list */}
                {isExpanded && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: '#FAFAFA' }}>
                    {ulp.regus.length === 0 ? (
                      <p style={{ fontSize: 12, textAlign: 'center', color: '#9CA3AF', fontWeight: 600, padding: '8px 0' }}>
                        Tidak ada regu terdaftar.
                      </p>
                    ) : (
                      ulp.regus.map(regu => (
                        <div key={regu.id} style={{
                          backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden',
                          border: regu.stats.lapor + regu.stats.ditangani + regu.stats.nyala_sementara > 0
                            ? '1.5px solid #F59E0B'
                            : '1.5px solid #E5E7EB',
                        }}>
                          <div style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                              <h3 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                {regu.nama}
                              </h3>
                              <StatusChips stats={regu.stats} total={regu.total} />
                            </div>

                            {/* Progress mini */}
                            <MiniBar stats={regu.stats} total={regu.total} />

                            {/* Petugas */}
                            <div style={{
                              marginTop: 8, padding: '6px 10px', borderRadius: 7,
                              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                              display: 'flex', alignItems: 'flex-start', gap: 6,
                            }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>👷</span>
                              <div>
                                <p style={{ fontSize: 9, fontWeight: 700, color: '#92400E', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Petugas Piket Aktif
                                </p>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0, lineHeight: 1.4 }}>
                                  {regu.petugas.length > 0
                                    ? regu.petugas.join(' · ')
                                    : <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 400 }}>Tidak ada petugas terdata</span>
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '12px 16px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          APKT Monitoring · PLN
        </p>
      </div>
    </div>
  )
}
