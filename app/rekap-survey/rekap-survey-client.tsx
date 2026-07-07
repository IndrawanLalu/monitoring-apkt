'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Deteksi layar sempit untuk beralih ke layout 1 kolom (client-only, ssr:false)
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

const PLN = '#003B8E'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const KEPUASAN_LABEL: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  sangat_puas:       { label: 'Sangat Puas',       emoji: '😄', color: '#059669', bg: '#ECFDF5' },
  puas:              { label: 'Puas',               emoji: '🙂', color: '#2563EB', bg: '#EFF6FF' },
  biasa:             { label: 'Biasa Saja',         emoji: '😐', color: '#D97706', bg: '#FFFBEB' },
  tidak_puas:        { label: 'Tidak Puas',         emoji: '🙁', color: '#EA580C', bg: '#FFF7ED' },
  sangat_tidak_puas: { label: 'Sangat Tidak Puas', emoji: '😡', color: '#DC2626', bg: '#FEF2F2' },
}
const RATING_ORDER = ['sangat_puas', 'puas', 'biasa', 'tidak_puas', 'sangat_tidak_puas'] as const

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
const YATIDAK_QUESTIONS: { key: keyof SurveyItem; q: string; goodWhen: 'ada' | 'tidak_ada' }[] = [
  { key: 'adaPungli',         q: 'Petugas meminta biaya tambahan (Pungli)?', goodWhen: 'tidak_ada' },
  { key: 'adaTips',           q: 'Ada permintaan uang tips/sukarela?',        goodWhen: 'tidak_ada' },
  { key: 'ada3s',             q: 'Petugas bersikap Senyum, Sapa, Salam (3S)?', goodWhen: 'ada' },
  { key: 'adaIdentitas',      q: 'Petugas menunjukkan identitas diri?',       goodWhen: 'ada' },
  { key: 'adaApd',            q: 'Petugas menggunakan APD (helm, sepatu)?',    goodWhen: 'ada' },
  { key: 'adaHalTidakSenang', q: 'Mengalami hal tidak menyenangkan?',         goodWhen: 'tidak_ada' },
]

export interface SurveyItem {
  nomorTiket: string; lokasi: string; ulpNama: string; petugas: string[]
  kepuasan: string; submittedAt: string
  namaPelanggan: string; alamat: string
  kondisiSetelah: string; kualitasPelayanan: string; kecepatanRespon: string
  adaPungli: string; adaTips: string; ada3s: string; adaIdentitas: string
  adaApd: string; adaHalTidakSenang: string; pesanSaran: string | null
}

export interface RekapSurveyData {
  year: number
  month: number
  ulps: { id: string; nama: string }[]
  selectedUlpId: string | null
  surveyList: SurveyItem[]
  ratingCounts: { sangat_puas: number; puas: number; biasa: number; tidak_puas: number; sangat_tidak_puas: number }
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
  border: '2px solid rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.15)',
  color: '#fff', cursor: 'pointer', outline: 'none',
}

export function RekapSurveyClient({ data }: { data: RekapSurveyData }) {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [detail, setDetail] = useState<SurveyItem | null>(null)

  function navigate(params: Record<string, string | null>) {
    const sp = new URLSearchParams()
    const yr = params.year   ?? String(data.year)
    const mo = params.month  ?? String(data.month)
    const ul = params.ulp_id !== undefined ? params.ulp_id : data.selectedUlpId
    if (yr) sp.set('year', yr)
    if (mo !== null && mo !== undefined) sp.set('month', mo)
    if (ul) sp.set('ulp_id', ul)
    router.push(`${pathname}?${sp.toString()}`)
  }

  const total = data.surveyList.length
  const periodeLabel = data.month === 0 ? `Tahun ${data.year}` : `${MONTHS[data.month - 1]} ${data.year}`

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F1F5F9', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* ─── Header sticky ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: `linear-gradient(135deg, ${PLN} 0%, #0055B3 100%)`, boxShadow: '0 4px 20px rgba(0,59,142,0.3)' }}>
        <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>Rekap Survey Pelanggan</h1>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0', fontWeight: 500 }}>{periodeLabel}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 14px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Total Survey</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#FCD34D', margin: 0 }}>{total}</p>
          </div>
        </div>

        {/* Filter */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={data.month} onChange={e => navigate({ month: e.target.value })} style={selectStyle}>
            <option value={0} style={{ color: '#000' }}>Semua Bulan</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1} style={{ color: '#000' }}>{m}</option>)}
          </select>
          <select value={data.year} onChange={e => navigate({ year: e.target.value })} style={selectStyle}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} style={{ color: '#000' }}>{y}</option>)}
          </select>
          {data.ulps.length > 1 && (
            <select value={data.selectedUlpId ?? ''} onChange={e => navigate({ ulp_id: e.target.value || null })} style={selectStyle}>
              <option value='' style={{ color: '#000' }}>Semua ULP</option>
              {data.ulps.map(u => <option key={u.id} value={u.id} style={{ color: '#000' }}>{u.nama}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ flex: 1, padding: '12px 12px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Distribusi rating */}
        <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1.5px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            Distribusi Kepuasan
          </p>
          {isMobile ? (
            // Mobile: daftar vertikal — emoji + label kiri, angka kanan (tidak menumpuk)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RATING_ORDER.map(key => {
                const cfg = KEPUASAN_LABEL[key]
                const val = data.ratingCounts[key]
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, backgroundColor: cfg.bg, border: `1.5px solid ${cfg.color}33` }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: cfg.color }}>
                      <span style={{ fontSize: 18 }}>{cfg.emoji}</span>{cfg.label}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: cfg.color }}>{val}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            // Desktop: 5 kotak sejajar
            <div style={{ display: 'flex', gap: 6 }}>
              {RATING_ORDER.map(key => {
                const cfg = KEPUASAN_LABEL[key]
                const val = data.ratingCounts[key]
                return (
                  <div key={key} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '8px 4px', borderRadius: 8, backgroundColor: cfg.bg, border: `1.5px solid ${cfg.color}33` }}>
                    <div style={{ fontSize: 20 }}>{cfg.emoji}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: cfg.color, lineHeight: 1.1 }}>{val}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: cfg.color, marginTop: 2 }}>{cfg.label}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Daftar survey */}
        <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1.5px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 10px' }}>📋 Daftar Survey ({total})</p>
          {total === 0 ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontWeight: 600, padding: '24px 0' }}>Belum ada survey pada periode ini</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.surveyList.map((s, i) => {
                const kfg = KEPUASAN_LABEL[s.kepuasan] ?? { label: s.kepuasan, emoji: '❓', color: '#64748B', bg: '#F1F5F9' }
                return (
                  <div key={i} onClick={() => setDetail(s)} style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 800, color: PLN, margin: 0 }}>#{s.nomorTiket}</p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', fontWeight: 500 }}>{s.ulpNama}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: kfg.color, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                        {kfg.emoji} {kfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#111827', margin: '0 0 4px', lineHeight: 1.5 }}>📍 {s.lokasi}</p>
                    {s.petugas.length > 0 && (
                      <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 4px' }}>👷 {s.petugas.join(' · ')}</p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>
                        {new Date(s.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: PLN }}>Lihat detail ›</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '12px 16px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          APKT Monitoring · PLN
        </p>
      </div>

      {detail && <SurveyDetailModal survey={detail} isMobile={isMobile} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '9px 0', borderBottom: '1px solid #E5E7EB' }}>
      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: color ?? '#111827', textAlign: 'right', flexShrink: 0, maxWidth: '55%' }}>{value}</span>
    </div>
  )
}

function SurveyDetailModal({ survey: s, isMobile, onClose }: { survey: SurveyItem; isMobile: boolean; onClose: () => void }) {
  const kfg = KEPUASAN_LABEL[s.kepuasan] ?? { label: s.kepuasan, emoji: '❓', color: '#64748B', bg: '#F1F5F9' }
  const secTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }
  const kepuasanBadge = (
    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 26 }}>{kfg.emoji}</span>
      <div>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kepuasan Keseluruhan</p>
        <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0 }}>{kfg.label}</p>
      </div>
    </div>
  )
  const closeBtn = (
    <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>×</button>
  )
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 8 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', width: '100%', maxWidth: 860, maxHeight: isMobile ? '94vh' : '96vh', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {/* Header modal */}
        <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${PLN} 0%, #0055B3 100%)`, padding: isMobile ? '14px 16px' : '16px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{s.nomorTiket}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0', fontWeight: 500 }}>{s.ulpNama}</p>
            </div>
            {isMobile ? closeBtn : <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{kepuasanBadge}{closeBtn}</div>}
          </div>
          {isMobile && <div style={{ marginTop: 12 }}>{kepuasanBadge}</div>}
        </div>

        {/* Body — 2 kolom di desktop, 1 kolom di mobile */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 16 : 22, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px 0' : '10px 32px', alignContent: 'start' }}>
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
                <p style={{ fontSize: 13, color: '#111827', margin: 0, lineHeight: 1.6, padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: 10, border: '1px solid #E5E7EB' }}>
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
