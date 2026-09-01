'use client'

import { useState } from 'react'
import type { RekapOutage } from './outage-client'

/**
 * Lapis ringkasan dashboard outage: baris KPI + empat panel visual.
 *
 * Grafik digambar sebagai SVG langsung, tanpa pustaka chart — beban halaman
 * tetap ringan dan warnanya bisa mengikuti token tema aplikasi.
 *
 * Palet dua seri (masuk vs selesai) sudah divalidasi terhadap gate
 * colorblind-safe: terang #0070C0/#17A34A (CVD ΔE 25,1 · normal 26,3 · kontras
 * ≥3:1), gelap #2E8FE0/#1B9E63 (CVD ΔE 19,4 · normal 20,8). Ambang aman ΔE 8.
 *
 * Ramp sekuensial (sebaran durasi & peta panas) satu hue, terang→gelap, dan
 * lolos gate ordinal di kedua mode — termasuk syarat ujung terang ≥2:1 terhadap
 * permukaan, supaya sel bernilai terkecil tetap terbedakan dari sel kosong.
 * Versi pertama ramp ini gagal di titik itu (#E3EEF9 hanya 1,15:1).
 *
 * Jangan mengganti warna apa pun di sini tanpa menjalankan ulang
 * scripts/validate_palette.js pada skill dataviz.
 */

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function jamMenit(menit: number | null): string {
  if (menit == null) return '—'
  if (menit < 60) return `${Math.round(menit)}m`
  const j = Math.floor(menit / 60)
  const m = Math.round(menit % 60)
  if (j >= 24) {
    const h = Math.floor(j / 24)
    return `${h}h ${j % 24}j`
  }
  return m === 0 ? `${j}j` : `${j}j ${m}m`
}

// ─── Kartu ────────────────────────────────────────────────────

function Kartu({ judul, catatan, children }: {
  judul: string; catatan?: string; children: React.ReactNode
}) {
  return (
    <section style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
      boxShadow: 'var(--shadow-sm)',
      minWidth: 0,
    }}>
      <header style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{judul}</h3>
        {catatan && (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '3px 0 0', fontWeight: 500 }}>{catatan}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function Kosong({ pesan = 'Tidak ada data pada periode ini' }: { pesan?: string }) {
  return (
    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '28px 0', margin: 0 }}>
      {pesan}
    </p>
  )
}

// ─── KPI ──────────────────────────────────────────────────────

/**
 * `lebihKecilLebihBaik` membalik arti warna delta: untuk durasi penanganan,
 * turun itu kabar baik.
 */
function Kpi({ label, nilai, satuan, sebelum, sekarang, lebihKecilLebihBaik, sampel }: {
  label: string
  nilai: string
  satuan?: string
  sebelum?: number | null
  sekarang?: number | null
  lebihKecilLebihBaik?: boolean
  sampel?: string
}) {
  let delta: { teks: string; baik: boolean } | null = null
  if (sebelum != null && sekarang != null && sebelum > 0) {
    const persen = Math.round(((sekarang - sebelum) / sebelum) * 100)
    if (persen !== 0) {
      const naik = persen > 0
      delta = {
        teks: `${naik ? '↑' : '↓'} ${Math.abs(persen)}%`,
        baik: lebihKecilLebihBaik ? !naik : naik,
      }
    }
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '13px 14px',
      minWidth: 0,
    }}>
      <p style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 26, fontWeight: 800, color: 'var(--text-primary)',
        margin: '6px 0 0', lineHeight: 1.05, letterSpacing: '-0.02em',
      }}>
        {nilai}
        {satuan && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 3 }}>{satuan}</span>}
      </p>
      <div style={{ minHeight: 17, marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
        {delta && (
          <span style={{
            fontSize: 11.5, fontWeight: 700,
            color: delta.baik ? 'var(--kpi-baik)' : 'var(--kpi-buruk)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {delta.teks}
          </span>
        )}
        {sampel && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{sampel}</span>
        )}
      </div>
    </div>
  )
}

// ─── Panel 1: tren harian (garis, 2 seri) ─────────────────────

function TrenHarian({ data }: { data: RekapOutage['trenHarian'] }) {
  const [aktif, setAktif] = useState<number | null>(null)
  if (!data || data.length === 0) return <Kosong />

  const urut = [...data].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  const maks = Math.max(1, ...urut.map(d => Math.max(d.masuk, d.selesai)))
  const W = 640, H = 200, padL = 34, padR = 52, padB = 24, padT = 8
  const plotW = W - padL - padR, plotH = H - padT - padB

  const x = (i: number) => padL + (urut.length === 1 ? plotW / 2 : (i / (urut.length - 1)) * plotW)
  const y = (v: number) => padT + plotH - (v / maks) * plotH
  const garis = (ambil: (d: typeof urut[0]) => number) =>
    urut.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(ambil(d)).toFixed(1)}`).join(' ')

  const tick = [0, Math.round(maks / 2), maks]
  const akhir = urut.length - 1
  const d = aktif != null ? urut[aktif] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img" aria-label="Tren gangguan masuk dan selesai per hari">
        {tick.map(t => (
          <g key={t}>
            <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 7} y={y(t) + 3.5} textAnchor="end"
              style={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}>{t}</text>
          </g>
        ))}

        <path d={garis(d => d.masuk)} fill="none" stroke="var(--seri-masuk)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />
        <path d={garis(d => d.selesai)} fill="none" stroke="var(--seri-selesai)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Label langsung di ujung kanan — identitas tidak bergantung warna saja */}
        <text x={x(akhir) + 8} y={y(urut[akhir].masuk) + 3.5}
          style={{ fontSize: 10.5, fill: 'var(--text-secondary)', fontWeight: 700 }}>Masuk</text>
        <text x={x(akhir) + 8} y={y(urut[akhir].selesai) + 3.5}
          style={{ fontSize: 10.5, fill: 'var(--text-secondary)', fontWeight: 700 }}>Selesai</text>

        {aktif != null && (
          <>
            <line x1={x(aktif)} x2={x(aktif)} y1={padT} y2={padT + plotH}
              stroke="var(--border-strong)" strokeWidth={1} />
            <circle cx={x(aktif)} cy={y(urut[aktif].masuk)} r={4.5} fill="var(--seri-masuk)"
              stroke="var(--bg-surface)" strokeWidth={2} />
            <circle cx={x(aktif)} cy={y(urut[aktif].selesai)} r={4.5} fill="var(--seri-selesai)"
              stroke="var(--bg-surface)" strokeWidth={2} />
          </>
        )}

        {/* Sasaran hover selebar kolom, jauh lebih besar dari titiknya */}
        {urut.map((_, i) => (
          <rect key={i} x={x(i) - plotW / urut.length / 2} y={padT}
            width={Math.max(4, plotW / urut.length)} height={plotH}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setAktif(i)} onMouseLeave={() => setAktif(null)} />
        ))}

        <text x={padL} y={H - 6} style={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}>
          {urut[0].tanggal.slice(8) || urut[0].tanggal}
        </text>
        <text x={padL + plotW} y={H - 6} textAnchor="end" style={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}>
          {urut[akhir].tanggal.slice(8) || urut[akhir].tanggal}
        </text>
      </svg>

      {d && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: '7px 10px', boxShadow: 'var(--shadow-md)',
          fontSize: 11.5, pointerEvents: 'none', minWidth: 108,
        }}>
          <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>{d.tanggal}</p>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--seri-masuk)', flexShrink: 0 }} />
            Masuk <b style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>{d.masuk}</b>
          </p>
          <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--seri-selesai)', flexShrink: 0 }} />
            Selesai <b style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>{d.selesai}</b>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Panel 2: sebaran durasi (batang, ramp sekuensial) ────────

const URUT_DURASI = ['< 1 jam', '1–3 jam', '3–6 jam', '> 6 jam']

function SebaranDurasi({ data }: { data: RekapOutage['sebaranDurasi'] }) {
  if (!data || data.length === 0) return <Kosong />

  const peta = Object.fromEntries(data.map(d => [d.label, d.jumlah]))
  const baris = URUT_DURASI.map((label, i) => ({ label, jumlah: peta[label] ?? 0, step: i }))
  const total = baris.reduce((s, b) => s + b.jumlah, 0)
  const maks = Math.max(1, ...baris.map(b => b.jumlah))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {baris.map(b => {
        const persen = total > 0 ? Math.round((b.jumlah / total) * 100) : 0
        return (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)',
              width: 56, flexShrink: 0, textAlign: 'right',
            }}>
              {b.label}
            </span>
            <div style={{ flex: 1, height: 20, backgroundColor: 'var(--bg-surface-2)', borderRadius: 4, overflow: 'hidden', minWidth: 0 }}>
              <div style={{
                width: `${(b.jumlah / maks) * 100}%`, height: '100%',
                backgroundColor: `var(--ramp-${b.step + 1})`,
                borderRadius: '0 4px 4px 0',
                transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
              }} />
            </div>
            <span style={{
              fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)',
              width: 74, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
            }}>
              {b.jumlah.toLocaleString('id-ID')}
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: 4 }}>{persen}%</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Panel 3: perbandingan ULP ────────────────────────────────

function PerUlp({ data }: { data: RekapOutage['perUlp'] }) {
  if (!data || data.length === 0) return <Kosong />
  const maks = Math.max(1, ...data.map(u => u.selesai))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map(u => (
        <div key={u.ulpId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)',
            width: 96, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }} title={u.nama}>
            {u.nama.replace(/^ULP\s+/, '')}
          </span>
          <div style={{ flex: 1, height: 20, backgroundColor: 'var(--bg-surface-2)', borderRadius: 4, overflow: 'hidden', minWidth: 0 }}>
            <div style={{
              width: `${(u.selesai / maks) * 100}%`, height: '100%',
              backgroundColor: 'var(--seri-masuk)', borderRadius: '0 4px 4px 0',
              transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
            }} />
          </div>
          <span style={{
            fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)',
            width: 46, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          }}>
            {u.selesai.toLocaleString('id-ID')}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
            width: 52, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          }}>
            {jamMenit(u.menitRata)}
          </span>
        </div>
      ))}
      <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '2px 0 0', textAlign: 'right', fontWeight: 600 }}>
        jumlah selesai · durasi rata-rata
      </p>
    </div>
  )
}

// ─── Panel 4: peta panas jam sibuk ────────────────────────────

function JamSibuk({ data }: { data: RekapOutage['jamSibuk'] }) {
  const [sel, setSel] = useState<{ hari: number; jam: number; jumlah: number } | null>(null)
  if (!data || data.length === 0) return <Kosong />

  const peta = new Map(data.map(d => [`${d.hari}-${d.jam}`, d.jumlah]))
  const maks = Math.max(1, ...data.map(d => d.jumlah))

  // Ramp sekuensial 5 langkah; 0 memakai permukaan agar "kosong" tidak
  // terbaca sebagai nilai rendah.
  const step = (v: number) => (v === 0 ? 0 : Math.min(5, Math.ceil((v / maks) * 5)))

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, minWidth: 460 }}>
          <tbody>
            {HARI.map((nama, hari) => (
              <tr key={hari}>
                <th style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textAlign: 'right', paddingRight: 6, whiteSpace: 'nowrap',
                }}>
                  {nama}
                </th>
                {Array.from({ length: 24 }, (_, jam) => {
                  const v = peta.get(`${hari}-${jam}`) ?? 0
                  const s = step(v)
                  return (
                    <td key={jam}
                      onMouseEnter={() => setSel({ hari, jam, jumlah: v })}
                      onMouseLeave={() => setSel(null)}
                      title={`${nama} ${String(jam).padStart(2, '0')}:00 — ${v} gangguan`}
                      aria-label={`${nama} pukul ${String(jam).padStart(2, '0')}:00, ${v} gangguan`}
                      style={{
                        width: 15, height: 15, borderRadius: 3,
                        backgroundColor: s === 0 ? 'var(--bg-surface-2)' : `var(--ramp-${s})`,
                        cursor: 'default',
                        outline: sel?.hari === hari && sel?.jam === jam ? '2px solid var(--text-primary)' : 'none',
                      }}
                    />
                  )
                })}
              </tr>
            ))}
            <tr>
              <td />
              {Array.from({ length: 24 }, (_, jam) => (
                <td key={jam} style={{ fontSize: 8.5, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, paddingTop: 2 }}>
                  {jam % 3 === 0 ? jam : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
        <span>{sel ? `${HARI[sel.hari]} ${String(sel.jam).padStart(2, '0')}:00 — ${sel.jumlah} gangguan` : 'Sedikit'}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(s => (
            <span key={s} style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: `var(--ramp-${s})` }} />
          ))}
          <span style={{ marginLeft: 4 }}>Banyak</span>
        </span>
      </div>
    </div>
  )
}

// ─── Susunan ──────────────────────────────────────────────────

export function PanelRingkasan({ rekap, sebelum }: {
  rekap: RekapOutage
  sebelum: RekapOutage | null
}) {
  const k = rekap.kpi
  const s = sebelum?.kpi
  const kepatuhan = rekap.kepatuhan

  return (
    <div className="viz-outage" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        .viz-outage {
          --seri-masuk:   #0070C0;
          --seri-selesai: #17A34A;
          --ramp-1: #84B7E2;
          --ramp-2: #5C9BCF;
          --ramp-3: #347FBC;
          --ramp-4: #0C63A9;
          --ramp-5: #004A80;
          --kpi-baik:  #15803D;
          --kpi-buruk: #C2410C;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .viz-outage {
            --seri-masuk:   #2E8FE0;
            --seri-selesai: #1B9E63;
            --ramp-1: #2C5273;
            --ramp-2: #356A94;
            --ramp-3: #3E82B5;
            --ramp-4: #4E9AD2;
            --ramp-5: #6FB4E4;
            --kpi-baik:  #4ADE80;
            --kpi-buruk: #FB923C;
          }
        }
        :root[data-theme="dark"] .viz-outage {
          --seri-masuk:   #2E8FE0;
          --seri-selesai: #1B9E63;
          --ramp-1: #2C5273;
          --ramp-2: #356A94;
          --ramp-3: #3E82B5;
          --ramp-4: #4E9AD2;
          --ramp-5: #6FB4E4;
          --kpi-baik:  #4ADE80;
          --kpi-buruk: #FB923C;
        }
        @media (prefers-reduced-motion: reduce) {
          .viz-outage * { transition: none !important; }
        }
      `}</style>

      {/* Lapis 1 — KPI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
        gap: 10,
      }}>
        <Kpi label="Gangguan Selesai" nilai={k.totalSelesai.toLocaleString('id-ID')}
          sebelum={s?.totalSelesai} sekarang={k.totalSelesai} />
        <Kpi label="Durasi Rata-rata" nilai={jamMenit(k.menitRata)}
          sebelum={s?.menitRata} sekarang={k.menitRata} lebihKecilLebihBaik />
        <Kpi label="Selesai < 3 Jam" nilai={k.persenDibawah3Jam == null ? '—' : String(k.persenDibawah3Jam)} satuan="%"
          sebelum={s?.persenDibawah3Jam} sekarang={k.persenDibawah3Jam} />
        <Kpi label="Indeks Kepuasan" nilai={k.indeksKepuasan == null ? '—' : String(k.indeksKepuasan)} satuan="/100"
          sebelum={s?.indeksKepuasan} sekarang={k.indeksKepuasan}
          sampel={`dari ${k.totalSurvey} survey`} />
        <Kpi label="Gangguan Masuk" nilai={k.totalMasuk.toLocaleString('id-ID')}
          sebelum={s?.totalMasuk} sekarang={k.totalMasuk} lebihKecilLebihBaik />
        <Kpi label="Masih Terbuka" nilai={k.masihTerbuka.toLocaleString('id-ID')} sampel="saat ini" />
      </div>

      {/* Lapis 2 — panel visual */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Kartu judul="Tren Harian" catatan="Gangguan masuk dibanding yang selesai">
          <TrenHarian data={rekap.trenHarian} />
        </Kartu>

        <Kartu judul="Sebaran Durasi Penanganan" catatan="Dari laporan masuk sampai ditandai selesai">
          <SebaranDurasi data={rekap.sebaranDurasi} />
        </Kartu>

        <Kartu judul="Perbandingan ULP" catatan="Jumlah gangguan selesai dan durasi rata-ratanya">
          <PerUlp data={rekap.perUlp} />
        </Kartu>

        <Kartu judul="Jam Sibuk" catatan="Waktu gangguan dilaporkan, per hari dan jam (WITA)">
          <JamSibuk data={rekap.jamSibuk} />
        </Kartu>
      </div>

      {/* Kepatuhan — angka survey selalu disertai ukuran sampelnya */}
      <Kartu
        judul="Kepatuhan Petugas di Lapangan"
        catatan={
          kepatuhan.totalSurvey === 0
            ? 'Belum ada survey pada periode ini'
            : `Dari ${kepatuhan.totalSurvey} survey pelanggan${
                k.totalSelesai > 0
                  ? ` — ${((kepatuhan.totalSurvey / k.totalSelesai) * 100).toFixed(1)}% dari gangguan selesai`
                  : ''
              }`
        }
      >
        {kepatuhan.totalSurvey === 0 ? (
          <Kosong pesan="Belum ada survey yang bisa dihitung" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
            {[
              { label: 'Senyum Sapa Salam', nilai: kepatuhan.persen3s },
              { label: 'Tunjukkan Identitas', nilai: kepatuhan.persenIdentitas },
              { label: 'Pakai APD', nilai: kepatuhan.persenApd },
            ].map(x => (
              <div key={x.label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 5px' }}>{x.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 7, backgroundColor: 'var(--bg-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${x.nilai ?? 0}%`, height: '100%',
                      backgroundColor: 'var(--seri-selesai)', borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {x.nilai == null ? '—' : `${x.nilai}%`}
                  </span>
                </div>
              </div>
            ))}
            {[
              { label: 'Laporan pungli', nilai: kepatuhan.jumlahPungli },
              { label: 'Diminta tips', nilai: kepatuhan.jumlahTips },
              { label: 'Hal tidak menyenangkan', nilai: kepatuhan.jumlahTidakSenang },
            ].map(x => (
              <div key={x.label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 5px' }}>{x.label}</p>
                <p style={{
                  fontSize: 20, fontWeight: 800, margin: 0, fontVariantNumeric: 'tabular-nums',
                  color: x.nilai > 0 ? '#E4002B' : 'var(--text-primary)',
                }}>
                  {x.nilai > 0 && <span style={{ fontSize: 14, marginRight: 4 }}>⚠</span>}
                  {x.nilai}
                </p>
              </div>
            ))}
          </div>
        )}
      </Kartu>
    </div>
  )
}
