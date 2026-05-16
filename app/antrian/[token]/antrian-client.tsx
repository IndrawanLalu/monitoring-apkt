'use client'

import { useState, useEffect, useCallback } from 'react'

import { STATUS_LABEL, STATUS_EMOJI, STATUS_COLOR } from '@/constants'
import type { StatusLaporan } from '@/constants'

interface QueueItem { position: number; isOwn: boolean; status: string }

export interface AntrianData {
  found: boolean
  reguNama?: string
  ulpNama?: string
  myStatus?: string
  myNomor?: string
  namaPelanggan?: string
  alamat?: string
  isSelesai?: boolean
  surveyDone?: boolean
  myPosition?: number
  totalAntrian?: number
  queue?: QueueItem[]
}

const REFRESH_INTERVAL = 15
const PLN_BLUE = '#003B8E'

// ─── Survey Form ─────────────────────────────────────────────

const KONDISI_OPTIONS = [
  { value: 'tidak_ada', label: 'Tidak ada gangguan / Listrik menyala normal' },
  { value: 'kadang_padam', label: 'Kadang-kadang padam' },
  { value: 'padam_sekarang', label: 'Listrik masih padam' },
]

const SKALA_OPTIONS = [
  { value: 'sangat_buruk', label: '1 - Sangat Buruk' },
  { value: 'buruk', label: '2 - Buruk' },
  { value: 'cukup', label: '3 - Cukup' },
  { value: 'baik', label: '4 - Baik' },
  { value: 'sangat_baik', label: '5 - Sangat Baik' },
]

const YA_TIDAK = [
  { value: 'ada', label: 'Ada' },
  { value: 'tidak_ada', label: 'Tidak Ada' },
]

const KEPUASAN = [
  { value: 'sangat_puas', emoji: '😄', label: 'Sangat Puas' },
  { value: 'puas', emoji: '🙂', label: 'Puas' },
  { value: 'biasa', emoji: '😐', label: 'Biasa Saja' },
  { value: 'tidak_puas', emoji: '🙁', label: 'Tidak Puas' },
  { value: 'sangat_tidak_puas', emoji: '😡', label: 'Sangat Tidak Puas' },
]

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', borderRadius: 14, padding: '16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,59,142,0.08)' },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 8 },
  radio: { display: 'flex', flexDirection: 'column', gap: 8 },
  radioItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#334155', transition: 'all 0.15s' },
  radioItemSelected: { borderColor: PLN_BLUE, backgroundColor: '#EFF6FF', color: PLN_BLUE, fontWeight: 700 },
  textarea: { width: '100%', minHeight: 80, borderRadius: 10, border: '1.5px solid #E2E8F0', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#1E293B', backgroundColor: '#fff' },
  btn: { width: '100%', padding: '14px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s' },
  note: { fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2, display: 'block' },
}

function RadioGroup({ name, options, value, onChange }: {
  name: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={s.radio}>
      {options.map(o => (
        <label key={o.value} style={{ ...s.radioItem, ...(value === o.value ? s.radioItemSelected : {}) }}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} style={{ accentColor: PLN_BLUE, width: 16, height: 16, flexShrink: 0 }} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

function SurveyForm({ token, nomor, nama, alamat, onDone }: {
  token: string; nomor: string; nama: string; alamat: string; onDone: () => void
}) {
  const [form, setForm] = useState({
    kondisi_setelah: '', kualitas_pelayanan: '', kecepatan_respon: '',
    ada_pungli: '', ada_tips: '', ada_3s: '', ada_identitas: '',
    ada_apd: '', ada_hal_tidak_senang: '', kepuasan_keseluruhan: '', pesan_saran: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit() {
    const req = form.kondisi_setelah && form.kualitas_pelayanan && form.kecepatan_respon &&
      form.ada_pungli && form.ada_tips && form.ada_3s && form.ada_identitas &&
      form.ada_apd && form.ada_hal_tidak_senang && form.kepuasan_keseluruhan
    if (!req) { setError('Harap lengkapi semua pertanyaan sebelum mengirim.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/antrian/${token}/survey`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (res.ok) onDone()
      else { const j = await res.json(); setError(j.error || 'Gagal mengirim survey.') }
    } catch { setError('Koneksi bermasalah. Coba lagi.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Info pelanggan (read-only) - hanya Nomor Lapor */}
      <div style={s.card}>
        <span style={s.note}>Data Laporan</span>
        <div style={{ marginTop: 6 }}>
          <label style={{ ...s.label, fontSize: 11, color: '#64748B', marginBottom: 4 }}>Nomor Lapor</label>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#003B8E', background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', border: '1.5px solid #BFDBFE', letterSpacing: '0.02em' }}>{nomor}</div>
        </div>
      </div>

      {/* Q1 */}
      <div style={s.card}>
        <label style={s.label}>1. Setelah perbaikan, apakah ada masalah sampai hari ini?</label>
        <RadioGroup name="kondisi" options={KONDISI_OPTIONS} value={form.kondisi_setelah} onChange={v => set('kondisi_setelah', v)} />
      </div>

      {/* Q2 */}
      <div style={s.card}>
        <label style={s.label}>2. Bagaimana kualitas pelayanan petugas PLN?</label>
        <RadioGroup name="kualitas" options={SKALA_OPTIONS} value={form.kualitas_pelayanan} onChange={v => set('kualitas_pelayanan', v)} />
      </div>

      {/* Q3 */}
      <div style={s.card}>
        <label style={s.label}>3. Bagaimana kecepatan respon petugas PLN?</label>
        <RadioGroup name="kecepatan" options={SKALA_OPTIONS} value={form.kecepatan_respon} onChange={v => set('kecepatan_respon', v)} />
      </div>

      {/* Q4–9 Ya/Tidak */}
      {[
        { key: 'ada_pungli', q: '4. Apakah petugas meminta biaya tambahan (Pungli)?' },
        { key: 'ada_tips', q: '5. Apakah ada permintaan uang tips/sukarela dari petugas?' },
        { key: 'ada_3s', q: '6. Apakah petugas bersikap Senyum, Sapa, dan Salam (3S)?' },
        { key: 'ada_identitas', q: '7. Apakah petugas menunjukkan identitas diri (ID Card/seragam)?' },
        { key: 'ada_apd', q: '8. Apakah petugas menggunakan Alat Pelindung Diri (APD/helm, sepatu)?' },
        { key: 'ada_hal_tidak_senang', q: '9. Apakah mengalami hal tidak menyenangkan (merokok/masuk tanpa izin)?' },
      ].map(({ key, q }) => (
        <div key={key} style={s.card}>
          <label style={s.label}>{q}</label>
          <RadioGroup name={key} options={YA_TIDAK} value={form[key as keyof typeof form]} onChange={v => set(key, v)} />
        </div>
      ))}

      {/* Q10 Kepuasan */}
      <div style={s.card}>
        <label style={s.label}>10. Secara keseluruhan, bagaimana kepuasan Anda terhadap pelayanan PLN?</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {KEPUASAN.map(k => (
            <button key={k.value} onClick={() => set('kepuasan_keseluruhan', k.value)} style={{
              flex: '1 1 80px', padding: '10px 6px', borderRadius: 10, border: '1.5px solid',
              borderColor: form.kepuasan_keseluruhan === k.value ? PLN_BLUE : '#E2E8F0',
              backgroundColor: form.kepuasan_keseluruhan === k.value ? '#EFF6FF' : '#fff',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 22 }}>{k.emoji}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: form.kepuasan_keseluruhan === k.value ? PLN_BLUE : '#64748B', textAlign: 'center' }}>{k.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Q11 Saran */}
      <div style={s.card}>
        <label style={s.label}>11. Pesan atau saran untuk PLN <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opsional)</span></label>
        <textarea style={s.textarea} placeholder="Tulis pesan atau saran Anda di sini..." value={form.pesan_saran} onChange={e => set('pesan_saran', e.target.value)} />
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: '#FEF2F2', border: '1.5px solid #FECACA', color: '#B91C1C', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading} style={{ ...s.btn, backgroundColor: loading ? '#94A3B8' : PLN_BLUE, color: '#fff', marginBottom: 24 }}>
        {loading ? 'Mengirim...' : '✅ Kirim Survey'}
      </button>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────

export function AntrinanClient({ token, initialData }: { token: string; initialData: AntrianData }) {
  const [data, setData] = useState<AntrianData>(initialData)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/antrian/${token}`, { cache: 'no-store' })
      if (res.ok) { setData(await res.json()); setLastUpdated(new Date()) }
    } finally { setRefreshing(false); setCountdown(REFRESH_INTERVAL) }
  }, [token])

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => { if (c <= 1) { void fetchData(); return REFRESH_INTERVAL } return c - 1 })
    }, 1000)
    return () => clearInterval(tick)
  }, [fetchData])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) void fetchData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchData])

  const container: React.CSSProperties = { minHeight: '100vh', backgroundColor: '#F1F5F9', fontFamily: "'Inter', sans-serif" }
  const inner: React.CSSProperties = { maxWidth: 440, margin: '0 auto', padding: '16px 16px 32px' }

  // Header
  const Header = () => (
    <div style={{ background: `linear-gradient(135deg, ${PLN_BLUE} 0%, #0055B3 100%)`, borderRadius: 16, padding: '20px 20px 16px', marginBottom: 16, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,59,142,0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <img src="/live-chat.png" alt="PLN" width={56} height={56} style={{ borderRadius: 12, display: 'block' }} />
      </div>
      <h1 style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Antrian Laporan PLN</h1>
      {data.reguNama && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '4px 0 0', fontWeight: 500 }}>{data.reguNama} · {data.ulpNama}</p>}
    </div>
  )

  const Footer = () => (
    <div style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 8 }}>
      <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 6px' }}>
        {refreshing ? 'Memperbarui...' : `Perbarui otomatis dalam ${countdown}s`}
      </p>
      {lastUpdated && <p style={{ fontSize: 11, color: '#CBD5E1', margin: '0 0 6px' }}>
        Terakhir: {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>}
      <button onClick={fetchData} disabled={refreshing} style={{ fontSize: 12, fontWeight: 700, color: PLN_BLUE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        Perbarui Sekarang
      </button>
    </div>
  )

  // Not found
  if (!data.found) {
    return (
      <div style={container}>
        <div style={inner}>
          <Header />
          <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px' }}>
            <span style={{ fontSize: 48 }}>❌</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1E293B', margin: '12px 0 6px' }}>Link Tidak Valid</h2>
            <p style={{ fontSize: 13, color: '#64748B' }}>Link antrian ini tidak ditemukan atau sudah tidak aktif.</p>
          </div>
        </div>
      </div>
    )
  }

  // Survey selesai / token expired
  if (surveySubmitted || data.surveyDone) {
    return (
      <div style={container}>
        <div style={inner}>
          <Header />
          <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px', background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' }}>
            <span style={{ fontSize: 52 }}>🎉</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#065F46', margin: '12px 0 6px' }}>Terima Kasih!</h2>
            <p style={{ fontSize: 13, color: '#047857', lineHeight: 1.6 }}>
              Survey Anda telah berhasil dikirim.<br />
              <strong>Tiket #{data.myNomor}</strong> sudah selesai ditangani.
            </p>
            <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)', fontSize: 12, color: '#065F46', fontWeight: 600 }}>
              🔒 Halaman ini tidak dapat diakses kembali
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 12 }}>APKT Monitoring · PLN</p>
        </div>
      </div>
    )
  }

  // Selesai + form/tombol survey
  if (data.isSelesai) {
    if (showSurvey) {
      return (
        <div style={container}>
          <div style={inner}>
            <Header />
            <div style={{ ...s.card, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: PLN_BLUE, margin: 0, textAlign: 'center' }}>
                📋 Survei Kepuasan Pelanggan — Tiket #{data.myNomor}
              </p>
            </div>
            <SurveyForm
              token={token}
              nomor={data.myNomor!}
              nama={data.namaPelanggan!}
              alamat={data.alamat!}
              onDone={() => setSurveySubmitted(true)}
            />
          </div>
        </div>
      )
    }

    return (
      <div style={container}>
        <div style={inner}>
          <Header />
          <div style={{ ...s.card, textAlign: 'center', padding: '28px 20px', background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', marginBottom: 16 }}>
            <span style={{ fontSize: 52 }}>✅</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#065F46', margin: '12px 0 6px' }}>Laporan Selesai Ditangani</h2>
            <p style={{ fontSize: 13, color: '#047857' }}>Tiket #{data.myNomor}</p>
            <p style={{ fontSize: 12, color: '#6EE7B7', marginTop: 4 }}>Terima kasih telah menggunakan layanan PLN</p>
          </div>

          <div style={{ ...s.card, border: '1.5px solid #BFDBFE', textAlign: 'center', padding: '20px 16px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: PLN_BLUE, margin: '0 0 4px' }}>📋 Bantu Kami Berkembang</p>
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 16px', lineHeight: 1.6 }}>
              Luangkan 2 menit untuk mengisi survey kepuasan layanan PLN Anda.
            </p>
            <button onClick={() => setShowSurvey(true)} style={{ ...s.btn, backgroundColor: PLN_BLUE, color: '#fff', borderRadius: 12 }}>
              📝 Isi Survey Sekarang
            </button>
            <button onClick={() => setSurveySubmitted(true)} style={{ width: '100%', padding: '10px', marginTop: 8, borderRadius: 10, border: 'none', background: 'none', fontSize: 12, color: '#94A3B8', cursor: 'pointer', fontWeight: 600 }}>
              Lewati (Tidak Ingin Mengisi)
            </button>
          </div>
          <Footer />
        </div>
      </div>
    )
  }

  // Antrian aktif
  const queue = data.queue ?? []
  return (
    <div style={container}>
      <div style={inner}>
        <Header />

        {/* Posisi */}
        <div style={{ ...s.card, textAlign: 'center', padding: '24px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Tiket #{data.myNomor}</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', margin: '0 0 12px' }}>Posisi Antrian Anda</p>
          <p style={{ fontSize: 80, fontWeight: 900, color: PLN_BLUE, lineHeight: 1, margin: '0 0 8px' }}>{data.myPosition ?? 0}</p>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
            dari <strong style={{ color: '#1E293B' }}>{data.totalAntrian ?? 0}</strong> antrian aktif
          </p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 700,
            backgroundColor: STATUS_COLOR[data.myStatus as StatusLaporan]?.bg ?? '#FEF2F2',
            color: STATUS_COLOR[data.myStatus as StatusLaporan]?.text ?? '#B91C1C',
            border: `1.5px solid ${STATUS_COLOR[data.myStatus as StatusLaporan]?.text ?? '#FCA5A5'}33`,
          }}>
            {STATUS_EMOJI[data.myStatus as StatusLaporan]} {STATUS_LABEL[data.myStatus as StatusLaporan]}
          </span>
        </div>

        {/* Daftar antrian */}
        <div style={s.card}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Antrian {data.reguNama}</p>
          {queue.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>Tidak ada antrian aktif</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {queue.map(item => (
                <div key={item.position} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 10, border: '1.5px solid',
                  borderColor: item.isOwn ? PLN_BLUE : '#E2E8F0',
                  backgroundColor: item.isOwn ? '#EFF6FF' : '#FAFAFA',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: item.isOwn ? PLN_BLUE : '#94A3B8', width: 24, textAlign: 'center', flexShrink: 0 }}>
                    {item.position}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: item.isOwn ? 700 : 500, color: item.isOwn ? PLN_BLUE : '#374151' }}>
                    Antrian #{item.position} {item.isOwn && <span style={{ fontSize: 11, fontWeight: 800 }}>(Anda)</span>}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px',
                    backgroundColor: STATUS_COLOR[item.status as StatusLaporan]?.bg ?? '#F3F4F6',
                    color: STATUS_COLOR[item.status as StatusLaporan]?.text ?? '#374151',
                  }}>
                    {STATUS_EMOJI[item.status as StatusLaporan]} {STATUS_LABEL[item.status as StatusLaporan]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </div>
  )
}
