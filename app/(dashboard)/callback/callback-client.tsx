'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { createLaporanSchema, type CreateLaporanInput } from '@/lib/validations/laporan'

interface ReguItem {
  id: string
  ulp_id: string
  nama: string
  nomor_hp: string | null
  created_at: string
  ulpNama: string
}

interface Props {
  reguList: ReguItem[]
  ulpId: string
  ulpNama: string
  template: string
  noActivePiket?: boolean
}

function parseApktDurasi(durasi: string): number {
  const match = durasi.trim().match(/^(\d+)\s*-\s*(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return 0
  const [, d, h, m, s] = match.map(Number)
  return d * 86400 + h * 3600 + m * 60 + s
}

function parseApkt(text: string): Partial<CreateLaporanInput> {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  const result: Partial<CreateLaporanInput> = {}
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

function applyTemplate(tpl: string, v: { nama: string; nomor_tiket: string; lokasi: string; regu: string; ulp: string; keterangan: string; link_antrian: string; no_hp: string }) {
  return tpl
    .replace(/\{nama\}/g, v.nama || '...')
    .replace(/\{nomor_tiket\}/g, v.nomor_tiket || '...')
    .replace(/\{lokasi\}/g, v.lokasi || '...')
    .replace(/\{regu\}/g, v.regu || '...')
    .replace(/\{ulp\}/g, v.ulp)
    .replace(/\{keterangan\}/g, v.keterangan || '-')
    .replace(/\{link_antrian\}/g, v.link_antrian || '')
    .replace(/\{no_hp\}/g, v.no_hp || '...')
}

// ── WA Preview ─────────────────────────────────────────────────────────────────

function WaPreview({ pesan, nomorHp }: { pesan: string; nomorHp: string }) {
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

      {/* Chat bubble area */}
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

      {/* Footer info */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Kirim ke:{' '}
          <span style={{ fontWeight: 700, color: valid ? 'var(--text-primary)' : '#E4002B' }}>
            {valid ? `+${nomorWa}` : 'Nomor belum diisi'}
          </span>
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          Template diubah di{' '}
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Pengaturan → Template Callback</span>.{' '}
          Var:{' '}
          {['{nama}', '{nomor_tiket}', '{lokasi}', '{regu}', '{ulp}', '{keterangan}', '{link_antrian}', '{no_hp}'].map((v) => (
            <code key={v} style={{ backgroundColor: 'var(--bg-surface-3)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>{v}</code>
          )).reduce<React.ReactNode[]>((a, e, i) => (i === 0 ? [e] : [...a, ' ', e]), [])}
        </p>
      </div>
    </div>
  )
}

// ── Done Screen ────────────────────────────────────────────────────────────────

function DoneScreen({ v, nr, mt, nhpRegu, onReset, onResend, ulpNama, template }: {
  v: CreateLaporanInput; nr: string; mt: string; nhpRegu: string
  onReset: () => void; onResend: () => void; ulpNama: string; template: string
}) {
  const nomorWa = formatNomorWa(v.nomor_pelanggan ?? '')
  const nomorValid = nomorWa.length >= 10
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const linkAntrian = mt ? `${base}/antrian/${mt}` : ''

  return (
    <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>✅</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>Laporan Tersimpan</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>WhatsApp telah dibuka otomatis</p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {([
            ['No. Tiket', v.nomor_tiket], ['Pelanggan', v.nama_pelanggan],
            ['No. HP', nomorValid ? `+${nomorWa}` : '—'], ['Lokasi', v.lokasi],
            ['Regu', nr], ['Status', v.status ?? 'lapor'],
            ...(v.keterangan ? [['Keterangan', v.keterangan]] : []),
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'var(--text-primary)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {linkAntrian && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔢</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Link Antrian</p>
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkAntrian}</p>
          </div>
          <button onClick={() => void navigator.clipboard.writeText(linkAntrian)} className="btn btn-secondary btn-sm">Salin</button>
        </div>
      )}

      <button onClick={onResend} disabled={!nomorValid} className="btn btn-primary"
        style={{ width: '100%', backgroundColor: '#25D366', fontSize: 14, padding: '12px 0' }}>
        📲 Buka WhatsApp Lagi
      </button>
      <button onClick={onReset} className="btn btn-secondary" style={{ width: '100%', fontSize: 13, padding: '10px 0' }}>
        + Input Laporan Baru
      </button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function CallbackClient({ reguList, ulpId, ulpNama, template, noActivePiket }: Props) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateLaporanInput, string>>>({})
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(true)
  const [done, setDone] = useState<{ values: CreateLaporanInput; namaRegu: string; magicToken: string; nomorHpRegu: string } | null>(null)
  const [values, setValues] = useState<CreateLaporanInput>({
    nomor_tiket: '', regu_id: '', nama_pelanggan: '', nomor_pelanggan: '',
    lokasi: '', keterangan: '', created_at: undefined, status: 'lapor',
  })

  function set<K extends keyof CreateLaporanInput>(key: K, value: CreateLaporanInput[K]) {
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

  const reguByUlp = useMemo(() => {
    const map = new Map<string, { ulpNama: string; regus: ReguItem[] }>()
    for (const r of reguList) {
      if (!map.has(r.ulp_id)) map.set(r.ulp_id, { ulpNama: r.ulpNama, regus: [] })
      map.get(r.ulp_id)!.regus.push(r)
    }
    return Array.from(map.values()).sort((a, b) => a.ulpNama.localeCompare(b.ulpNama))
  }, [reguList])

  const selectedRegu = reguList.find((r) => r.id === values.regu_id)
  const namaRegu = selectedRegu?.nama ?? ''
  const nomorHpRegu = selectedRegu?.nomor_hp ?? ''

  const pesanWa = useMemo(() =>
    applyTemplate(template, {
      nama: values.nama_pelanggan, nomor_tiket: values.nomor_tiket,
      lokasi: values.lokasi, regu: namaRegu, ulp: ulpNama, keterangan: values.keterangan ?? '',
      link_antrian: '[link antrian]', no_hp: nomorHpRegu,
    }),
    [template, values.nama_pelanggan, values.nomor_tiket, values.lokasi, namaRegu, ulpNama, values.keterangan, nomorHpRegu],
  )

  function bukaWa(v: CreateLaporanInput, nama: string, magicToken = '', nomorHpReguVal = '') {
    const nomor = formatNomorWa(v.nomor_pelanggan ?? '')
    if (!nomor || nomor.length < 10) return
    const linkAntrian = magicToken ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/antrian/${magicToken}` : ''
    const pesan = applyTemplate(template, {
      nama: v.nama_pelanggan, nomor_tiket: v.nomor_tiket,
      lokasi: v.lokasi, regu: nama, ulp: ulpNama, keterangan: v.keterangan ?? '',
      link_antrian: linkAntrian, no_hp: nomorHpReguVal,
    })
    window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, '_blank')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const result = createLaporanSchema.safeParse(values)
    if (!result.success) {
      const errs: Partial<Record<keyof CreateLaporanInput, string>> = {}
      result.error.issues.forEach((err) => { errs[err.path[0] as keyof CreateLaporanInput] = err.message })
      setFieldErrors(errs); return
    }
    setLoading(true)
    const res = await fetch('/api/callback/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result.data, ulp_id: ulpId }),
    })
    const json = await res.json() as { data: { id: string; magic_token: string } | null; error: string | null }
    setLoading(false)
    if (!res.ok || json.error) { setServerError(json.error ?? 'Gagal menyimpan laporan'); return }
    const magicToken = json.data?.magic_token ?? ''
    setDone({ values: result.data, namaRegu, magicToken, nomorHpRegu })
    bukaWa(result.data, namaRegu, magicToken, nomorHpRegu)
  }

  function handleReset() {
    setValues({ nomor_tiket: '', regu_id: '', nama_pelanggan: '', nomor_pelanggan: '', lokasi: '', keterangan: '', created_at: undefined, status: 'lapor' })
    setPasteText(''); setShowPaste(true); setDone(null)
  }

  // ── Done Screen
  if (done) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader ulpNama={ulpNama} />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <DoneScreen
            v={done.values} nr={done.namaRegu} mt={done.magicToken} nhpRegu={done.nomorHpRegu}
            ulpNama={ulpNama} template={template}
            onReset={handleReset}
            onResend={() => bukaWa(done.values, done.namaRegu, done.magicToken, done.nomorHpRegu)}
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

              {/* Regu selector */}
              <div style={{ gridColumn: '1 / -1' }}>
                {noActivePiket ? (
                  <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.08)', border: '1px solid rgba(228,0,43,0.25)' }}>
                    <p style={{ fontSize: 13, color: '#E4002B', fontWeight: 500, margin: 0 }}>
                      Tidak ada piket aktif —{' '}
                      <a href="/piket" style={{ textDecoration: 'underline', fontWeight: 700 }}>buat piket dulu</a>
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Regu *</label>
                    <select
                      value={values.regu_id}
                      onChange={(e) => set('regu_id', e.target.value)}
                      className="input"
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">Pilih regu...</option>
                      {reguByUlp.map(({ ulpNama: uNama, regus }) => (
                        <optgroup key={uNama} label={uNama}>
                          {regus.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {fieldErrors.regu_id && <p style={{ fontSize: 12, color: '#E4002B', marginTop: 3, fontWeight: 500 }}>{fieldErrors.regu_id}</p>}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <Select label="Status Awal" value={values.status ?? 'lapor'} onChange={(e) => set('status', e.target.value as CreateLaporanInput['status'])}>
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
                <Input label="Nomor Pelanggan" placeholder="081234567890" value={values.nomor_pelanggan ?? ''}
                  onChange={(e) => set('nomor_pelanggan', e.target.value || null)} error={fieldErrors.nomor_pelanggan}
                  hint="Digunakan untuk buka WhatsApp ke pelanggan" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Lokasi *" placeholder="Jl. Merdeka No. 10" value={values.lokasi} onChange={(e) => set('lokasi', e.target.value)} error={fieldErrors.lokasi} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea label="Keterangan" placeholder="Keterangan tambahan..." rows={3}
                  value={values.keterangan ?? ''} onChange={(e) => set('keterangan', e.target.value || null)} error={fieldErrors.keterangan} />
              </div>
            </div>

            {serverError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)' }}>
                <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>⚠ {serverError}</p>
              </div>
            )}
            <Button type="submit" variant="primary" size="md" style={{ width: '100%' }} loading={loading} disabled={noActivePiket}>
              Simpan &amp; Buka WhatsApp →
            </Button>
          </form>
        </div>

        {/* Preview Panel */}
        <div style={{ width: 360, flexShrink: 0, padding: 20, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface-2)' }}>
          <WaPreview pesan={pesanWa} nomorHp={values.nomor_pelanggan ?? ''} />
        </div>
      </div>
    </div>
  )
}

function PageHeader({ ulpNama }: { ulpNama: string }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>📞</span>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>CC Callback</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Input laporan dari telepon pelanggan · {ulpNama}
          </p>
        </div>
      </div>
    </div>
  )
}
