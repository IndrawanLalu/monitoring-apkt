'use client'

import { useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const KEPUASAN_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  sangat_puas:       { label: 'Sangat Puas',       emoji: '😄', color: '#065F46' },
  puas:              { label: 'Puas',               emoji: '🙂', color: '#1E40AF' },
  biasa:             { label: 'Biasa Saja',         emoji: '😐', color: '#92400E' },
  tidak_puas:        { label: 'Tidak Puas',         emoji: '🙁', color: '#9A3412' },
  sangat_tidak_puas: { label: 'Sangat Tidak Puas', emoji: '😡', color: '#7F1D1D' },
}
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const PLN = '#003B8E'

const thStyle: React.CSSProperties = {
  padding: '6px 5px', textAlign: 'center', fontWeight: 700, fontSize: 11,
  color: '#475569', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '5px 4px', textAlign: 'center', fontSize: 11,
  border: '1px solid #E2E8F0', whiteSpace: 'nowrap',
}

export interface OutageData {
  year: number
  month: number
  ulps: { id: string; nama: string }[]
  selectedUlpId: string | null
  totalSelesai: number
  petugasSelesaiList: { nama: string; ulpNama: string; count: number }[]
  petugasPuasList: { nama: string; ulpNama: string; sangat_puas: number; puas: number; biasa: number; tidak_puas: number; sangat_tidak_puas: number; total: number }[]
  surveyList: { nomorTiket: string; lokasi: string; ulpNama: string; petugas: string[]; kepuasan: string; submittedAt: string }[]
  calendarDays: { tanggal: string; petugas: { nama: string; count: number }[]; total: number }[]
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(0,59,142,0.07)', ...style }}>{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>{children}</h2>
}

function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, backgroundColor: bg, borderRadius: 20, padding: '3px 10px', border: `1px solid ${color}33` }}>{children}</span>
}

type Tab = 'rating' | 'selesai' | 'survey' | 'kalender'

export function OutageClient({ data, profileRole }: { data: OutageData; profileRole: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('rating')

  const calendarMatrix = useMemo(() => {
    const petugasSet = new Set<string>()
    const matrix: Record<string, Record<number, number>> = {}
    data.calendarDays.forEach((day, i) => {
      const d = i + 1
      day.petugas.forEach(({ nama, count }) => {
        petugasSet.add(nama)
        if (!matrix[nama]) matrix[nama] = {}
        matrix[nama][d] = (matrix[nama][d] ?? 0) + count
      })
    })
    return {
      petugasList: [...petugasSet].sort((a, b) => {
        const totalA = Object.values(matrix[a] ?? {}).reduce((s, v) => s + v, 0)
        const totalB = Object.values(matrix[b] ?? {}).reduce((s, v) => s + v, 0)
        return totalB - totalA
      }),
      matrix,
      days: data.calendarDays.map((_, i) => i + 1),
      dayTotals: data.calendarDays.map(d => d.total),
    }
  }, [data.calendarDays])

  function navigate(params: Record<string, string | null>) {
    const sp = new URLSearchParams()
    const yr = params.year   ?? String(data.year)
    const mo = params.month  ?? String(data.month)
    const ul = params.ulp_id !== undefined ? params.ulp_id : data.selectedUlpId
    if (yr) sp.set('year', yr)
    if (mo) sp.set('month', mo)
    if (ul) sp.set('ulp_id', ul)
    router.push(`${pathname}?${sp.toString()}`)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rating',   label: '⭐ Rating Puas' },
    { key: 'selesai',  label: '✅ Kinerja Petugas' },
    { key: 'survey',   label: '📋 Daftar Survey' },
    { key: 'kalender', label: '📅 Kalender' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${PLN} 0%, #0055B3 100%)`, padding: '14px 20px', boxShadow: '0 4px 16px rgba(0,59,142,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>⚡ Outage Report</h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '2px 0 0', fontWeight: 500 }}>
              {data.month === 0 ? `Tahun ${data.year}` : `${MONTHS[data.month - 1]} ${data.year}`} · {data.totalSelesai} gangguan selesai
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600 }}>Survey</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#FCD34D', margin: 0 }}>{data.surveyList.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Month */}
          <select value={data.month} onChange={e => navigate({ month: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PLN, cursor: 'pointer' }}>
            <option value={0}>Semua Bulan</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          {/* Year */}
          <select value={data.year} onChange={e => navigate({ year: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PLN, cursor: 'pointer' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* ULP filter */}
          {data.ulps.length > 1 && (
            <select value={data.selectedUlpId ?? ''} onChange={e => navigate({ ulp_id: e.target.value || null })}
              style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PLN, cursor: 'pointer' }}>
              <option value=''>Semua ULP</option>
              {data.ulps.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid #E2E8F0', backgroundColor: '#fff', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '11px 16px', fontSize: 12, fontWeight: tab === t.key ? 800 : 500,
            whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
            borderBottom: tab === t.key ? `2.5px solid ${PLN}` : '2.5px solid transparent',
            backgroundColor: 'transparent', color: tab === t.key ? PLN : '#64748B',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ─── TAB: Rating Puas ──────────────────────────────────── */}
        {tab === 'rating' && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <SectionTitle>⭐ Rating Kepuasan per Petugas</SectionTitle>
              {data.petugasPuasList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '16px 0' }}>Belum ada data survey periode ini</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.petugasPuasList.map((p, i) => (
                    <div key={`${p.nama}-${p.ulpNama}`} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
                      borderRadius: 10, backgroundColor: i === 0 ? '#FFFBEB' : '#F8FAFC',
                      border: `1.5px solid ${i === 0 ? '#FCD34D' : '#E2E8F0'}`,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? '#D97706' : '#94A3B8', width: 28, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', margin: 0 }}>{p.nama}</p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 6px', fontWeight: 500 }}>{p.ulpNama}</p>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {([
                            ['sangat_puas', p.sangat_puas],
                            ['puas', p.puas],
                            ['biasa', p.biasa],
                            ['tidak_puas', p.tidak_puas],
                            ['sangat_tidak_puas', p.sangat_tidak_puas],
                          ] as [string, number][]).map(([key, val]) => {
                            if (val === 0) return null
                            const kfg = KEPUASAN_LABEL[key]
                            return (
                              <Badge key={key} color={kfg.color} bg={`${kfg.color}18`}>
                                {kfg.emoji} {val}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: PLN, margin: 0 }}>{p.total}</p>
                        <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>survey</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ─── TAB: Kinerja Petugas ──────────────────────────────── */}
        {tab === 'selesai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Terbanyak */}
            <Card>
              <SectionTitle>🏆 Petugas Gangguan Selesai Terbanyak</SectionTitle>
              {data.petugasSelesaiList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '8px 0' }}>Belum ada data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.petugasSelesaiList.slice(0, 5).map((p, i) => {
                    const max = data.petugasSelesaiList[0].count
                    const pct = max > 0 ? (p.count / max) * 100 : 0
                    return (
                      <div key={`${p.nama}-${p.ulpNama}-top`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `${i + 1}. `}{p.nama}</span>
                            <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>{p.ulpNama}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 900, color: PLN }}>{p.count}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${PLN}, #0EA5E9)`, borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Tersedikit */}
            {data.petugasSelesaiList.length > 1 && (
              <Card>
                <SectionTitle>📉 Petugas Gangguan Selesai Tersedikit</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...data.petugasSelesaiList].reverse().slice(0, 5).map((p, i) => (
                    <div key={`${p.nama}-${p.ulpNama}-bot`} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 10, backgroundColor: '#FFF7F7',
                      border: '1.5px solid #FECACA',
                    }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', margin: 0 }}>{i + 1}. {p.nama}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{p.ulpNama}</p>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#DC2626' }}>{p.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ─── TAB: Daftar Survey ────────────────────────────────── */}
        {tab === 'survey' && (
          <Card>
            <SectionTitle>📋 Daftar Gangguan dengan Survey ({data.surveyList.length})</SectionTitle>
            {data.surveyList.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '16px 0' }}>Belum ada survey bulan ini</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.surveyList.map((s, i) => {
                  const kfg = KEPUASAN_LABEL[s.kepuasan] ?? { label: s.kepuasan, emoji: '❓', color: '#374151' }
                  return (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 800, color: PLN, margin: 0 }}>#{s.nomorTiket}</p>
                          <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0', fontWeight: 500 }}>{s.ulpNama}</p>
                        </div>
                        <Badge color={kfg.color} bg={`${kfg.color}15`}>{kfg.emoji} {kfg.label}</Badge>
                      </div>
                      <p style={{ fontSize: 12, color: '#374151', margin: '0 0 4px', lineHeight: 1.5 }}>📍 {s.lokasi}</p>
                      {s.petugas.length > 0 && (
                        <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 4px' }}>👷 {s.petugas.join(' · ')}</p>
                      )}
                      <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>
                        {new Date(s.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ─── TAB: Kalender ─────────────────────────────────────── */}
        {tab === 'kalender' && (
          <Card>
            <SectionTitle>📅 Rekap Petugas per {data.month === 0 ? 'Bulan' : 'Tanggal'} — {data.month === 0 ? data.year : `${MONTHS[data.month - 1]} ${data.year}`}</SectionTitle>
            {calendarMatrix.petugasList.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 24 }}>Belum ada gangguan selesai bulan ini</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left', minWidth: 110, position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#F1F5F9' }}>
                        Petugas
                      </th>
                      {calendarMatrix.days.map(d => (
                        <th key={d} style={{ ...thStyle, minWidth: data.month === 0 ? 36 : 26 }}>
                          {data.month === 0 ? MONTHS[d - 1] : d}
                        </th>
                      ))}
                      <th style={{ ...thStyle, backgroundColor: '#EFF6FF', color: PLN, minWidth: 40 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarMatrix.petugasList.map((nama, ri) => {
                      const total = calendarMatrix.days.reduce((s, d) => s + (calendarMatrix.matrix[nama]?.[d] ?? 0), 0)
                      return (
                        <tr key={nama} style={{ backgroundColor: ri % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: '#1E293B', paddingLeft: 8, position: 'sticky', left: 0, zIndex: 1, backgroundColor: ri % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            👷 {nama}
                          </td>
                          {calendarMatrix.days.map(d => {
                            const val = calendarMatrix.matrix[nama]?.[d] ?? 0
                            return (
                              <td key={d} style={{ ...tdStyle, backgroundColor: val > 0 ? '#EFF6FF' : undefined, color: val > 0 ? PLN : '#CBD5E1', fontWeight: val > 0 ? 800 : 400 }}>
                                {val > 0 ? val : '·'}
                              </td>
                            )
                          })}
                          <td style={{ ...tdStyle, fontWeight: 900, color: PLN, backgroundColor: '#EFF6FF' }}>{total}</td>
                        </tr>
                      )
                    })}
                    <tr style={{ borderTop: '2px solid #CBD5E1' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800, color: '#fff', backgroundColor: PLN, paddingLeft: 8, position: 'sticky', left: 0, zIndex: 1 }}>
                        Total
                      </td>
                      {calendarMatrix.dayTotals.map((t, i) => (
                        <td key={i} style={{ ...tdStyle, fontWeight: t > 0 ? 800 : 400, color: t > 0 ? PLN : '#CBD5E1', backgroundColor: '#EFF6FF' }}>
                          {t > 0 ? t : '·'}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, fontWeight: 900, color: '#fff', backgroundColor: PLN }}>
                        {calendarMatrix.dayTotals.reduce((s, v) => s + v, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
