'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'

interface Props {
  ulpNama: string
  ulpId: string
}

interface FormValues {
  nomor_tiket: string
  nama_pelanggan: string
  nomor_pelanggan: string
  lokasi: string
  keterangan: string
  status: string
  created_at?: string
}

const TEMPLATE_NYALA = `Yth. Bapak/Ibu {nama},

Terima kasih atas kepercayaan Anda pada PLN. Kami memohon maaf atas ketidaknyamanan terkait laporan gangguan dengan nomor {nomor_tiket}.

Mohon konfirmasi apakah listrik sudah kembali normal agar laporan dapat kami tutup. Kami juga sangat menghargai masukan Bapak/Ibu melalui survei singkat ini: https://bit.ly/4kuk23u.

untuk kemudahan mendapatkan informasi dan layanan PLN lainnya, Bapak/Ibu dapat memanfaatkan aplikasi PLN Mobile yang telah tersedia.

Salam hangat,
Command Center UP3 Mataram
Melayani Sepenuh Hati`

const TEMPLATE_PADAM_MELUAS = `Yth. Bapak/Ibu {nama},

Terima kasih atas kepercayaan Anda pada PLN. Kami memohon maaf atas ketidaknyamanan terkait laporan gangguan dengan nomor {nomor_tiket}.
Kami menginformasikan bahwa laporan tersebut terdampak pemadaman meluas akibat kendala jaringan, mohon konfirmasi apakah saat ini listrik di lokasi Bapak/Ibu sudah kembali normal?

Masukan Anda sangat berarti bagi kami melalui: https://bit.ly/4aMzkxi. Kami juga menyarankan penggunaan PLN Mobile untuk kemudahan informasi dan layanan PLN lainnya.

Salam hangat,
Command Center UP3 Mataram
Melayani Sepenuh Hati`

function parseApktDurasi(durasi: string): number {
  const match = durasi.trim().match(/^(\d+)\s*-\s*(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return 0
  const [, d, h, m, s] = match.map(Number)
  return d * 86400 + h * 3600 + m * 60 + s
}

function parseApkt(text: string): Partial<FormValues> {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  const result: Partial<FormValues> = {}
  for (const line of lines) {
    if (/^G\d{10,}/.test(line)) { result.nomor_tiket = line.trim(); continue }
    const cols = line.split('\t')
    if (cols.length >= 4) {
      if (cols[0]?.trim()) result.nama_pelanggan = cols[0].trim()
      const apktStatus = cols[2]?.trim().toLowerCase() ?? ''
      if (apktStatus.includes('nyala sementara')) result.status = 'nyala_sementara'
      else if (apktStatus === 'nyala') result.status = 'selesai'
      else if (['penugasan regu', 'dalam perjalanan', 'dalam pengerjaan'].includes(apktStatus)) result.status = 'ditangani'
      else result.status = 'lapor'
      if (cols[3]?.trim()) result.lokasi = cols[3].trim()
      if (cols[6]?.trim()) result.nomor_pelanggan = cols[6].trim()
      if (cols[7]?.trim()) result.keterangan = cols[7].trim()
      if (cols[1]?.trim()) {
        const detik = parseApktDurasi(cols[1].trim())
        if (detik > 0) result.created_at = new Date(Date.now() - detik * 1000).toISOString()
      }
    }
  }
  return result
}

function formatNomorWa(nomor: string): string {
  const clean = nomor.replace(/\D/g, '')
  if (clean.startsWith('62')) return clean
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  return '62' + clean
}

function applyTemplate(tpl: string, v: { nama: string; nomor_tiket: string; ulp: string; link_antrian?: string }) {
  return tpl
    .replace(/\{nama\}/g, v.nama || '...')
    .replace(/\{nomor_tiket\}/g, v.nomor_tiket || '...')
    .replace(/\{ulp\}/g, v.ulp)
    .replace(/\{link_antrian\}/g, v.link_antrian || '')
}

// ── WA Preview ─────────────────────────────────────────────────────────────────

function WaPreview({ pesan, nomorHp, kondisi, onKondisiChange }: {
  pesan: string
  nomorHp: string
  kondisi: 'nyala' | 'padam_meluas'
  onKondisiChange: (k: 'nyala' | 'padam_meluas') => void
}) {
  const nomorWa = formatNomorWa(nomorHp)
  const valid = nomorWa.length >= 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 16 }}>📱</span>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Preview Pesan WA
        </h2>
      </div>

      {/* Chat bubble area — WhatsApp themed but adaptive */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 12,
        borderRadius: 10,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface-2)',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)',
        backgroundSize: '20px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            backgroundColor: '#25D366',
            borderRadius: '12px 2px 12px 12px',
            padding: '10px 14px',
            maxWidth: '90%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}>
            <p style={{ fontSize: 12, color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
              {pesan.split('\n').map((line, i, arr) => {
                const parts = line.split(/(\*[^*]+\*)/g)
                return (
                  <span key={i}>
                    {parts.map((p, j) =>
                      p.startsWith('*') && p.endsWith('*')
                        ? <strong key={j} style={{ fontWeight: 700 }}>{p.slice(1, -1)}</strong>
                        : <span key={j}>{p}</span>
                    )}
                    {i < arr.length - 1 && <br />}
                  </span>
                )
              })}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', textAlign: 'right', marginTop: 4, marginBottom: 0 }}>
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ✓✓
            </p>
          </div>
        </div>
      </div>

      {/* Kondisi selector */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Format Info
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {([
            { val: 'nyala',        label: '✅ Nyala'        },
            { val: 'padam_meluas', label: '🔴 Padam Meluas' },
          ] as const).map(({ val, label }) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="radio"
                checked={kondisi === val}
                onChange={() => onKondisiChange(val)}
                style={{ accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }}
              />
              <span style={{ fontWeight: kondisi === val ? 600 : 400, color: 'var(--text-primary)' }}>{label}</span>
            </label>
          ))}
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Kirim ke:{' '}
            <span style={{ fontWeight: 700, color: valid ? 'var(--text-primary)' : '#E4002B' }}>
              {valid ? `+${nomorWa}` : 'Nomor belum diisi'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Done Screen ────────────────────────────────────────────────────────────────

function DoneCard({ v, mt, kondisi, ulpNama, onReset, onResend }: {
  v: FormValues
  mt: string
  kondisi: 'nyala' | 'padam_meluas'
  ulpNama: string
  onReset: () => void
  onResend: () => void
}) {
  const nomorWa = formatNomorWa(v.nomor_pelanggan ?? '')
  const nomorValid = nomorWa.length >= 10
  const base = process.env.NEXT_PUBLIC_ANTRIAN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const linkAntrian = mt ? `${base}/antrian/${mt}` : ''

  return (
    <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Success card */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>✅</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>Siap Kirim Pesan</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>WhatsApp telah dibuka otomatis</p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {([
            ['No. Tiket', v.nomor_tiket],
            ['Pelanggan', v.nama_pelanggan],
            ['No. HP', nomorValid ? `+${nomorWa}` : '—'],
            ['Lokasi', v.lokasi],
            ['Format Info', kondisi === 'nyala' ? 'Nyala' : 'Padam Meluas'],
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'var(--text-primary)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Link antrian */}
      {linkAntrian && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔢</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Link Antrian</p>
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {linkAntrian}
            </p>
          </div>
          <button
            onClick={() => void navigator.clipboard.writeText(linkAntrian)}
            className="btn btn-secondary btn-sm"
          >
            Salin
          </button>
        </div>
      )}

      {/* Actions */}
      <button
        onClick={onResend}
        disabled={!nomorValid}
        className="btn btn-primary"
        style={{ width: '100%', backgroundColor: '#25D366', fontSize: 14, padding: '12px 0' }}
      >
        📲 Buka WhatsApp Lagi
      </button>
      <button onClick={onReset} className="btn btn-secondary" style={{ width: '100%', fontSize: 13, padding: '10px 0' }}>
        + Input Pelanggan Baru
      </button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function CcCallbackClient({ ulpNama, ulpId }: Props) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(true)
  const [done, setDone] = useState<{ values: FormValues; magicToken: string } | null>(null)
  const [kondisi, setKondisi] = useState<'nyala' | 'padam_meluas'>('nyala')
  const [values, setValues] = useState<FormValues>({
    nomor_tiket: '', nama_pelanggan: '', nomor_pelanggan: '',
    lokasi: '', keterangan: '', created_at: undefined, status: 'lapor',
  })

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handlePaste(text: string) {
    setPasteText(text)
    if (!text.trim()) return
    const parsed = parseApkt(text)
    if (Object.keys(parsed).length === 0) return
    setValues((prev) => ({ ...prev, ...parsed }))
    setFieldErrors({})
    setShowPaste(false)
  }

  const template = kondisi === 'nyala' ? TEMPLATE_NYALA : TEMPLATE_PADAM_MELUAS

  const pesanWa = useMemo(() =>
    applyTemplate(template, { nama: values.nama_pelanggan, nomor_tiket: values.nomor_tiket, ulp: ulpNama }),
    [template, values.nama_pelanggan, values.nomor_tiket, ulpNama],
  )

  function bukaWa(v: FormValues, magicToken = '') {
    const nomor = formatNomorWa(v.nomor_pelanggan ?? '')
    if (!nomor || nomor.length < 10) return
    const linkAntrian = magicToken ? `${process.env.NEXT_PUBLIC_ANTRIAN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/antrian/${magicToken}` : ''
    const pesan = applyTemplate(template, { nama: v.nama_pelanggan, nomor_tiket: v.nomor_tiket, ulp: ulpNama, link_antrian: linkAntrian })
    window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, '_blank')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Partial<Record<keyof FormValues, string>> = {}
    if (!values.nomor_tiket) errs.nomor_tiket = 'Nomor tiket wajib diisi'
    if (!values.nama_pelanggan) errs.nama_pelanggan = 'Nama pelanggan wajib diisi'
    if (!values.nomor_pelanggan || values.nomor_pelanggan.length < 10) errs.nomor_pelanggan = 'Nomor HP tidak valid'
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }

    setServerError(null)
    setLoading(true)
    const res = await fetch('/api/cc-callback/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, ulp_id: ulpId, status_callback: kondisi === 'nyala' ? 'Nyala' : 'Padam Meluas' }),
    })
    const json = await res.json() as { data: { id: string; magic_token: string } | null; error: string | null }
    setLoading(false)
    if (!res.ok || json.error) { setServerError(json.error ?? 'Gagal menyimpan sinkronisasi database'); return }
    const magicToken = json.data?.magic_token ?? ''
    setDone({ values, magicToken })
    bukaWa(values, magicToken)
  }

  function handleReset() {
    setValues({ nomor_tiket: '', nama_pelanggan: '', nomor_pelanggan: '', lokasi: '', keterangan: '', created_at: undefined, status: 'lapor' })
    setPasteText(''); setShowPaste(true); setDone(null)
  }

  // ── Done Screen
  if (done) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader ulpNama={ulpNama} />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <DoneCard
            v={done.values} mt={done.magicToken} kondisi={kondisi} ulpNama={ulpNama}
            onReset={handleReset}
            onResend={() => bukaWa(done.values, done.magicToken)}
          />
        </div>
      </div>
    )
  }

  // ── Form Screen
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader ulpNama={ulpNama} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, borderRight: '1px solid var(--border)' }}>
          <form onSubmit={handleSubmit} style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Paste APKT */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', backgroundColor: 'var(--accent-subtle)' }}>
              <button type="button"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setShowPaste((p) => !p)}>
                <span>📋 Paste dari APKT</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{showPaste ? '▲' : '▼'}</span>
              </button>
              {showPaste && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea rows={3} placeholder="Copy baris dari tabel APKT, lalu paste di sini..."
                    value={pasteText} onChange={(e) => handlePaste(e.target.value)}
                    className="input" style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }} />
                  {values.created_at && (
                    <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, margin: 0 }}>
                      ⏱ Waktu APKT: {new Date(values.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Form akan terisi otomatis dari data yang di-paste.</p>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Nomor Tiket *" placeholder="G441550xxx" value={values.nomor_tiket} onChange={(e) => set('nomor_tiket', e.target.value)} error={fieldErrors.nomor_tiket} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Select label="Status Awal" value={values.status ?? 'lapor'} onChange={(e) => set('status', e.target.value)}>
                  <option value="lapor">Lapor</option>
                  <option value="ditangani">Sedang Ditangani</option>
                  <option value="nyala_sementara">Nyala Sementara</option>
                  <option value="selesai">Selesai</option>
                </Select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Nama Pelanggan *" placeholder="Budi Santoso" value={values.nama_pelanggan} onChange={(e) => set('nama_pelanggan', e.target.value)} error={fieldErrors.nama_pelanggan} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Nomor Pelanggan *" placeholder="081234567890" value={values.nomor_pelanggan ?? ''}
                  onChange={(e) => set('nomor_pelanggan', e.target.value || '')} error={fieldErrors.nomor_pelanggan}
                  hint="Digunakan untuk buka WhatsApp ke pelanggan" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Lokasi" placeholder="Jl. Merdeka No. 10" value={values.lokasi} onChange={(e) => set('lokasi', e.target.value)} error={fieldErrors.lokasi} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea label="Keterangan" placeholder="Keterangan tambahan..." rows={3}
                  value={values.keterangan ?? ''} onChange={(e) => set('keterangan', e.target.value || '')} error={fieldErrors.keterangan} />
              </div>
            </div>

            {serverError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)' }}>
                <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>⚠ {serverError}</p>
              </div>
            )}
            <Button type="submit" variant="primary" size="md" style={{ width: '100%' }} loading={loading}>
              Simpan &amp; Buka WhatsApp →
            </Button>
          </form>
        </div>

        {/* Preview Panel */}
        <div style={{ width: 360, flexShrink: 0, padding: 20, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface-2)' }}>
          <WaPreview pesan={pesanWa} nomorHp={values.nomor_pelanggan ?? ''} kondisi={kondisi} onKondisiChange={setKondisi} />
        </div>
      </div>
    </div>
  )
}

function PageHeader({ ulpNama }: { ulpNama: string }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>☎️</span>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>CC Call Back</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Info / Follow-up Laporan Pelanggan · {ulpNama}
          </p>
        </div>
      </div>
    </div>
  )
}
