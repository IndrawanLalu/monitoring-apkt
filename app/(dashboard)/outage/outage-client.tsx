'use client'

import { useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PanelRingkasan } from './panel-ringkasan'

const KEPUASAN_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  sangat_puas:       { label: 'Sangat Puas',       emoji: '😄', color: '#059669' },
  puas:              { label: 'Puas',               emoji: '🙂', color: '#2563EB' },
  biasa:             { label: 'Biasa Saja',         emoji: '😐', color: '#D97706' },
  tidak_puas:        { label: 'Tidak Puas',         emoji: '🙁', color: '#EA580C' },
  sangat_tidak_puas: { label: 'Sangat Tidak Puas', emoji: '😡', color: '#DC2626' },
}
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const PLN = '#003B8E'

// ─── Label maps untuk detail survey (konsisten dgn form antrian) ───────
const KONDISI_LABEL: Record<string, string> = {
  tidak_ada:      'Tidak ada gangguan / listrik normal',
  kadang_padam:   'Kadang-kadang padam',
  padam_sekarang: 'Listrik masih padam',
}
const SKALA_LABEL: Record<string, string> = {
  sangat_buruk: '1 · Sangat Buruk',
  buruk:        '2 · Buruk',
  cukup:        '3 · Cukup',
  baik:         '4 · Baik',
  sangat_baik:  '5 · Sangat Baik',
}
// Pertanyaan Ya/Tidak — goodWhen menentukan warna hijau/merah
const YATIDAK_QUESTIONS: { key: keyof SurveyItem; q: string; goodWhen: 'ada' | 'tidak_ada' }[] = [
  { key: 'adaPungli',         q: 'Petugas meminta biaya tambahan (Pungli)?',            goodWhen: 'tidak_ada' },
  { key: 'adaTips',           q: 'Ada permintaan uang tips/sukarela?',                   goodWhen: 'tidak_ada' },
  { key: 'ada3s',             q: 'Petugas bersikap Senyum, Sapa, Salam (3S)?',           goodWhen: 'ada' },
  { key: 'adaIdentitas',      q: 'Petugas menunjukkan identitas diri?',                  goodWhen: 'ada' },
  { key: 'adaApd',            q: 'Petugas menggunakan APD (helm, sepatu)?',              goodWhen: 'ada' },
  { key: 'adaHalTidakSenang', q: 'Mengalami hal tidak menyenangkan?',                    goodWhen: 'tidak_ada' },
]

export interface SurveyItem {
  nomorTiket: string; lokasi: string; ulpNama: string; petugas: string[]
  kepuasan: string; submittedAt: string
  namaPelanggan: string; alamat: string
  kondisiSetelah: string; kualitasPelayanan: string; kecepatanRespon: string
  adaPungli: string; adaTips: string; ada3s: string; adaIdentitas: string
  adaApd: string; adaHalTidakSenang: string; pesanSaran: string | null
}

/** Bentuk balikan fungsi Postgres rekap_outage(). */
export interface RekapOutage {
  kpi: {
    totalSelesai: number
    totalMasuk: number
    menitRata: number | null
    menitTengah: number | null
    persenDibawah3Jam: number | null
    totalSurvey: number
    indeksKepuasan: number | null
    masihTerbuka: number
  }
  trenHarian: { tanggal: string; masuk: number; selesai: number }[]
  sebaranDurasi: { label: string; jumlah: number }[]
  perUlp: { ulpId: string; nama: string; selesai: number; menitRata: number | null }[]
  jamSibuk: { hari: number; jam: number; jumlah: number }[]
  petugasSelesai: { nama: string; ulpNama: string; jumlah: number; menitRata: number | null }[]
  petugasPuas: {
    nama: string; ulpNama: string
    sangatPuas: number; puas: number; biasa: number; tidakPuas: number; sangatTidakPuas: number
    total: number
  }[]
  kalender: { tanggal: string; total: number; petugas: { nama: string; jumlah: number }[] }[]
  kepatuhan: {
    totalSurvey: number
    persen3s: number | null
    persenIdentitas: number | null
    persenApd: number | null
    jumlahPungli: number
    jumlahTips: number
    jumlahTidakSenang: number
  }
  insiden: {
    nomorTiket: string; namaPelanggan: string; alamat: string; submittedAt: string
    pungli: boolean; tips: boolean; tidakSenang: boolean
    pesanSaran: string | null; petugas: string[]
  }[]
}

export interface OutageData {
  year: number
  month: number
  ulps: { id: string; nama: string }[]
  selectedUlpId: string | null
  totalSelesai: number
  petugasSelesaiList: { nama: string; ulpNama: string; count: number; menitRata: number | null }[]
  petugasPuasList: { nama: string; ulpNama: string; sangat_puas: number; puas: number; biasa: number; tidak_puas: number; sangat_tidak_puas: number; total: number }[]
  surveyList: SurveyItem[]
  calendarDays: { tanggal: string; petugas: { nama: string; count: number }[]; total: number }[]
  /** Agregat mentah dari rekap_outage — dipakai lapis KPI & panel visual. */
  rekap: RekapOutage
  /** Periode pembanding (bulan/tahun sebelumnya) untuk delta KPI. */
  rekapSebelum: RekapOutage | null
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      borderRadius: 14,
      padding: 16,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
    </h2>
  )
}

/** Menit → "6j 24m" / "38m" / "3h 2j". */
function durasi(menit: number | null): string {
  if (menit == null) return '—'
  if (menit < 60) return `${Math.round(menit)}m`
  const j = Math.floor(menit / 60)
  if (j >= 24) return `${Math.floor(j / 24)}h ${j % 24}j`
  const m = Math.round(menit % 60)
  return m === 0 ? `${j}j` : `${j}j ${m}m`
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: '#fff',
      backgroundColor: color, borderRadius: 20,
      padding: '3px 10px',
    }}>
      {children}
    </span>
  )
}

type Tab = 'ringkasan' | 'rating' | 'selesai' | 'survey' | 'kepatuhan' | 'kalender'

export function OutageClient({ data }: { data: OutageData; profileRole: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [detail, setDetail] = useState<SurveyItem | null>(null)

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
    { key: 'ringkasan', label: '📊 Ringkasan' },
    { key: 'rating',   label: '⭐ Rating Puas' },
    { key: 'selesai',  label: '✅ Kinerja Petugas' },
    { key: 'survey',   label: '📋 Daftar Survey' },
    { key: 'kepatuhan', label: '🛡 Kepatuhan' },
    { key: 'kalender', label: '📅 Kalender' },
  ]

  const thStyle: React.CSSProperties = {
    padding: '6px 5px', textAlign: 'center', fontWeight: 700, fontSize: 11,
    color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-2)',
    border: '1px solid var(--border)', whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '5px 4px', textAlign: 'center', fontSize: 11,
    border: '1px solid var(--border)', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
      {/* Header — PLN branding, selalu biru */}
      <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${PLN} 0%, #0055B3 100%)`, padding: '14px 20px', boxShadow: '0 4px 16px rgba(0,59,142,0.3)' }}>
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
          <select value={data.month} onChange={e => navigate({ month: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PLN, cursor: 'pointer' }}>
            <option value={0}>Semua Bulan</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={data.year} onChange={e => navigate({ year: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PLN, cursor: 'pointer' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
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
      <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '11px 16px', fontSize: 12, fontWeight: tab === t.key ? 800 : 500,
            whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
            borderBottom: tab === t.key ? `2.5px solid var(--accent)` : '2.5px solid transparent',
            backgroundColor: 'transparent',
            color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ─── TAB: Ringkasan ────────────────────────────────────── */}
        {tab === 'ringkasan' && (
          <PanelRingkasan rekap={data.rekap} sebelum={data.rekapSebelum} />
        )}

        {/* ─── TAB: Rating Puas ──────────────────────────────────── */}
        {tab === 'rating' && (
          <Card>
            <SectionTitle>⭐ Rating Kepuasan per Petugas</SectionTitle>
            {data.petugasPuasList.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Belum ada data survey periode ini</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.petugasPuasList.map((p, i) => (
                  <div key={`${p.nama}-${p.ulpNama}`} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
                    borderRadius: 10,
                    backgroundColor: i === 0 ? 'rgba(251,191,36,0.1)' : 'var(--bg-surface-2)',
                    border: `1.5px solid ${i === 0 ? '#F59E0B' : 'var(--border)'}`,
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? '#D97706' : 'var(--text-muted)', width: 28, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{p.nama}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 6px', fontWeight: 500 }}>{p.ulpNama}</p>
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
                            <Badge key={key} color={kfg.color}>
                              {kfg.emoji} {val}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', margin: 0 }}>{p.total}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>survey</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── TAB: Kinerja Petugas ──────────────────────────────── */}
        {tab === 'selesai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card>
              <SectionTitle>🏆 Petugas Gangguan Selesai Terbanyak</SectionTitle>
              {data.petugasSelesaiList.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Belum ada data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.petugasSelesaiList.slice(0, 5).map((p, i) => {
                    const max = data.petugasSelesaiList[0].count
                    const pct = max > 0 ? (p.count / max) * 100 : 0
                    return (
                      <div key={`${p.nama}-${p.ulpNama}-top`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `${i + 1}. `}{p.nama}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{p.ulpNama}</span>
                          </div>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }} title="Durasi penanganan rata-rata">
                              ⏱ {durasi(p.menitRata)}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent)' }}>{p.count}</span>
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${PLN}, #0EA5E9)`, borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {data.petugasSelesaiList.length > 1 && (
              <Card>
                <SectionTitle>📉 Petugas Gangguan Selesai Tersedikit</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...data.petugasSelesaiList].reverse().slice(0, 5).map((p, i) => (
                    <div key={`${p.nama}-${p.ulpNama}-bot`} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 10,
                      backgroundColor: 'rgba(220,38,38,0.06)',
                      border: '1.5px solid rgba(220,38,38,0.25)',
                    }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{i + 1}. {p.nama}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{p.ulpNama}</p>
                      </div>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }} title="Durasi penanganan rata-rata">
                          ⏱ {durasi(p.menitRata)}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#DC2626' }}>{p.count}</span>
                      </span>
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
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Belum ada survey bulan ini</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.surveyList.map((s, i) => {
                  const kfg = KEPUASAN_LABEL[s.kepuasan] ?? { label: s.kepuasan, emoji: '❓', color: '#64748B' }
                  return (
                    <div key={i} onClick={() => setDetail(s)} style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', backgroundColor: 'var(--bg-surface-2)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>#{s.nomorTiket}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>{s.ulpNama}</p>
                        </div>
                        <Badge color={kfg.color}>{kfg.emoji} {kfg.label}</Badge>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.5 }}>📍 {s.lokasi}</p>
                      {s.petugas.length > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 4px' }}>👷 {s.petugas.join(' · ')}</p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
                          {new Date(s.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Lihat detail ›</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ─── TAB: Kepatuhan ────────────────────────────────────── */}
        {tab === 'kepatuhan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card>
              <SectionTitle>🛡 Insiden yang Perlu Ditindaklanjuti</SectionTitle>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.55 }}>
                Laporan pelanggan yang menyebutkan permintaan biaya tambahan, permintaan tips, atau
                hal tidak menyenangkan. Diambil dari {data.rekap.kepatuhan.totalSurvey} survey pada periode ini.
              </p>

              {data.rekap.insiden.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '28px 16px', borderRadius: 10,
                  backgroundColor: 'rgba(29,185,84,0.08)', border: '1.5px solid rgba(29,185,84,0.25)',
                }}>
                  <p style={{ fontSize: 26, margin: 0 }}>✅</p>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 0' }}>
                    Tidak ada insiden dilaporkan
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    {data.rekap.kepatuhan.totalSurvey === 0
                      ? 'Belum ada survey masuk pada periode ini, jadi belum ada yang bisa dinilai.'
                      : 'Tidak ada pelanggan yang melaporkan pungli, permintaan tips, maupun hal tidak menyenangkan.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.rekap.insiden.map((x, i) => (
                    <div key={`${x.nomorTiket}-${i}`} style={{
                      padding: '12px 14px', borderRadius: 10,
                      border: '1.5px solid rgba(228,0,43,0.3)',
                      backgroundColor: 'rgba(228,0,43,0.05)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>#{x.nomorTiket}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
                          {new Date(x.submittedAt).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar',
                          })}
                        </p>
                      </div>

                      {/* Jenis insiden selalu berlabel teks, bukan warna saja */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {x.pungli && <Badge color="#B91C1C">⚠ Pungli</Badge>}
                        {x.tips && <Badge color="#C2410C">⚠ Diminta tips</Badge>}
                        {x.tidakSenang && <Badge color="#A16207">⚠ Hal tidak menyenangkan</Badge>}
                      </div>

                      <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {x.namaPelanggan}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
                        {x.alamat}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Petugas: </span>
                        <b style={{ color: 'var(--text-primary)' }}>
                          {x.petugas.length > 0 ? x.petugas.join(', ') : '—'}
                        </b>
                      </p>

                      {x.pesanSaran && (
                        <p style={{
                          fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0',
                          padding: '8px 10px', borderRadius: 8, backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)', fontStyle: 'italic', lineHeight: 1.55,
                        }}>
                          “{x.pesanSaran}”
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}


        {/* ─── TAB: Kalender ─────────────────────────────────────── */}
        {tab === 'kalender' && (
          <Card>
            <SectionTitle>📅 Rekap Petugas per {data.month === 0 ? 'Bulan' : 'Tanggal'} — {data.month === 0 ? data.year : `${MONTHS[data.month - 1]} ${data.year}`}</SectionTitle>
            {calendarMatrix.petugasList.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>Belum ada gangguan selesai bulan ini</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left', minWidth: 110, position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'var(--bg-surface-3)' }}>
                        Petugas
                      </th>
                      {calendarMatrix.days.map(d => (
                        <th key={d} style={{ ...thStyle, minWidth: data.month === 0 ? 36 : 26 }}>
                          {data.month === 0 ? MONTHS[d - 1] : d}
                        </th>
                      ))}
                      <th style={{ ...thStyle, backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', minWidth: 40 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarMatrix.petugasList.map((nama, ri) => {
                      const total = calendarMatrix.days.reduce((s, d) => s + (calendarMatrix.matrix[nama]?.[d] ?? 0), 0)
                      const rowBg = ri % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-2)'
                      return (
                        <tr key={nama}>
                          <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 8, position: 'sticky', left: 0, zIndex: 1, backgroundColor: rowBg }}>
                            👷 {nama}
                          </td>
                          {calendarMatrix.days.map(d => {
                            const val = calendarMatrix.matrix[nama]?.[d] ?? 0
                            return (
                              <td key={d} style={{
                                ...tdStyle,
                                backgroundColor: val > 0 ? 'var(--accent-subtle)' : undefined,
                                color: val > 0 ? 'var(--accent)' : 'var(--border-strong)',
                                fontWeight: val > 0 ? 800 : 400,
                              }}>
                                {val > 0 ? val : '·'}
                              </td>
                            )
                          })}
                          <td style={{ ...tdStyle, fontWeight: 900, color: 'var(--accent)', backgroundColor: 'var(--accent-subtle)' }}>{total}</td>
                        </tr>
                      )
                    })}
                    <tr style={{ borderTop: '2px solid var(--border-strong)' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800, color: '#fff', backgroundColor: PLN, paddingLeft: 8, position: 'sticky', left: 0, zIndex: 1 }}>
                        Total
                      </td>
                      {calendarMatrix.dayTotals.map((t, i) => (
                        <td key={i} style={{ ...tdStyle, fontWeight: t > 0 ? 800 : 400, color: t > 0 ? 'var(--accent)' : 'var(--border-strong)', backgroundColor: 'var(--accent-subtle)' }}>
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

      {detail && <SurveyDetailModal survey={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: color ?? 'var(--text-primary)', textAlign: 'right', flexShrink: 0, maxWidth: '55%' }}>{value}</span>
    </div>
  )
}

function SurveyDetailModal({ survey: s, onClose }: { survey: SurveyItem; onClose: () => void }) {
  const kfg = KEPUASAN_LABEL[s.kepuasan] ?? { label: s.kepuasan, emoji: '❓', color: '#64748B' }
  const secTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)', width: '100%', maxWidth: 860,
          maxHeight: '96vh', display: 'flex', flexDirection: 'column',
          borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header modal */}
        <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${PLN} 0%, #0055B3 100%)`, padding: '16px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>#{s.nomorTiket}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0', fontWeight: 500 }}>{s.ulpNama}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>{kfg.emoji}</span>
                <div>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kepuasan Keseluruhan</p>
                  <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0 }}>{kfg.label}</p>
                </div>
              </div>
              <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          </div>
        </div>

        {/* Body modal — 2 kolom agar muat 1 layar tanpa scroll */}
        <div style={{ flex: 1, overflow: 'auto', padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px', alignContent: 'start' }}>
          {/* Kolom kiri */}
          <div>
            <p style={secTitle}>Data Pelanggan</p>
            <DetailRow label="Nama Pelanggan" value={s.namaPelanggan} />
            <DetailRow label="Alamat" value={s.alamat} />
            <DetailRow label="Lokasi Gangguan" value={s.lokasi} />
            {s.petugas.length > 0 && <DetailRow label="Petugas" value={s.petugas.join(', ')} />}
            <DetailRow label="Waktu Survey" value={new Date(s.submittedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />

            <p style={{ ...secTitle, marginTop: 16 }}>Penilaian</p>
            <DetailRow label="Kondisi setelah perbaikan" value={KONDISI_LABEL[s.kondisiSetelah] ?? s.kondisiSetelah} />
            <DetailRow label="Kualitas pelayanan" value={SKALA_LABEL[s.kualitasPelayanan] ?? s.kualitasPelayanan} />
            <DetailRow label="Kecepatan respon" value={SKALA_LABEL[s.kecepatanRespon] ?? s.kecepatanRespon} />
          </div>

          {/* Kolom kanan */}
          <div>
            <p style={secTitle}>Sikap & Kepatuhan Petugas</p>
            {YATIDAK_QUESTIONS.map(({ key, q, goodWhen }) => {
              const val = s[key] as string
              const good = val === goodWhen
              const color = good ? '#059669' : '#DC2626'
              const label = val === 'ada' ? 'Ya' : val === 'tidak_ada' ? 'Tidak' : val
              return <DetailRow key={key} label={q} value={<span>{good ? '✓' : '✕'} {label}</span>} color={color} />
            })}

            {s.pesanSaran && s.pesanSaran.trim() !== '' && (
              <>
                <p style={{ ...secTitle, marginTop: 16 }}>Saran / Pesan</p>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, padding: '10px 12px', backgroundColor: 'var(--bg-surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  “{s.pesanSaran}”
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
