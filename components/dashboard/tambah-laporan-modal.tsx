'use client'

import { useState, useMemo, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { createLaporanSchema, type CreateLaporanInput } from '@/lib/validations/laporan'

export interface ReguForModal {
  id: string
  ulp_id: string
  nama: string
  nomor_hp: string | null
  ulpNama: string
}

interface Props {
  open: boolean
  onClose: () => void
  reguList: ReguForModal[]
  ulpId: string
  ulpNama: string
  template: string
  defaultReguId?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function applyTemplate(tpl: string, v: {
  nama: string; nomor_tiket: string; lokasi: string
  regu: string; ulp: string; keterangan: string
  link_antrian: string; no_hp: string
}) {
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

// ─── Done State ──────────────────────────────────────────────────────────────

function DoneState({ values, namaRegu, magicToken, nomorHpRegu, ulpNama, template, onReset, onClose }: {
  values: CreateLaporanInput
  namaRegu: string
  magicToken: string
  nomorHpRegu: string
  ulpNama: string
  template: string
  onReset: () => void
  onClose: () => void
}) {
  const base = process.env.NEXT_PUBLIC_ANTRIAN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const linkAntrian = magicToken ? `${base}/antrian/${magicToken}` : ''
  const nomorWa = formatNomorWa(values.nomor_pelanggan ?? '')
  const nomorValid = nomorWa.length >= 10

  function bukaWaLagi() {
    const pesan = applyTemplate(template, {
      nama: values.nama_pelanggan, nomor_tiket: values.nomor_tiket,
      lokasi: values.lokasi, regu: namaRegu, ulp: ulpNama,
      keterangan: values.keterangan ?? '', link_antrian: linkAntrian, no_hp: nomorHpRegu,
    })
    window.open(`https://wa.me/${nomorWa}?text=${encodeURIComponent(pesan)}`, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 10 }}>
        <span style={{ fontSize: 28 }}>✅</span>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#166534', margin: 0 }}>Laporan Tersimpan</p>
          <p style={{ fontSize: 12, color: '#16A34A', margin: '2px 0 0' }}>WA group & WA pelanggan sudah dibuka</p>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {([
          ['No. Tiket', values.nomor_tiket],
          ['Pelanggan', values.nama_pelanggan],
          ['No. HP', nomorValid ? `+${nomorWa}` : '—'],
          ['Lokasi', values.lokasi],
          ['Regu', namaRegu],
          ...(values.keterangan ? [['Keterangan', values.keterangan]] : []),
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', width: 80, flexShrink: 0 }}>{label}</span>
            <span style={{ color: 'var(--text-primary)' }}>{val}</span>
          </div>
        ))}
      </div>

      {linkAntrian && (
        <div style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔢</span>
          <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {linkAntrian}
          </p>
          <button onClick={() => navigator.clipboard.writeText(linkAntrian)} className="btn btn-secondary btn-sm">Salin</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {nomorValid && (
          <Button variant="secondary" style={{ flex: 1, backgroundColor: '#25D366', color: '#fff', borderColor: '#25D366' }} onClick={bukaWaLagi}>
            📲 Buka WA Lagi
          </Button>
        )}
        <Button variant="secondary" style={{ flex: 1 }} onClick={onReset}>+ Input Baru</Button>
        <Button variant="primary" style={{ flex: 1 }} onClick={onClose}>Selesai</Button>
      </div>
    </div>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

const emptyValues = (reguId = ''): CreateLaporanInput => ({
  nomor_tiket: '', regu_id: reguId, nama_pelanggan: '', nomor_pelanggan: '',
  lokasi: '', keterangan: '', created_at: undefined, status: 'penugasan_regu',
})

export function TambahLaporanModal({ open, onClose, reguList, ulpId, ulpNama, template, defaultReguId }: Props) {
  const [values, setValues] = useState<CreateLaporanInput>(() => emptyValues(defaultReguId))
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateLaporanInput, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(true)
  const [done, setDone] = useState<{ values: CreateLaporanInput; namaRegu: string; magicToken: string; nomorHpRegu: string; reguUlpNama: string } | null>(null)

  // Saat modal dibuka dari regu berbeda, reset form dan pre-select regu
  useEffect(() => {
    if (open) {
      setValues(emptyValues(defaultReguId))
      setPasteText('')
      setShowPaste(true)
      setServerError(null)
      setFieldErrors({})
      setDone(null)
    }
  }, [open, defaultReguId])

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
    const map = new Map<string, { ulpNama: string; regus: ReguForModal[] }>()
    for (const r of reguList) {
      if (!map.has(r.ulp_id)) map.set(r.ulp_id, { ulpNama: r.ulpNama, regus: [] })
      map.get(r.ulp_id)!.regus.push(r)
    }
    return Array.from(map.values()).sort((a, b) => a.ulpNama.localeCompare(b.ulpNama))
  }, [reguList])

  const selectedRegu = reguList.find((r) => r.id === values.regu_id)
  const namaRegu = selectedRegu?.nama ?? ''
  const nomorHpRegu = selectedRegu?.nomor_hp ?? ''
  const reguUlpNama = selectedRegu?.ulpNama ?? ulpNama

  function reset() {
    setValues(emptyValues(defaultReguId))
    setPasteText('')
    setShowPaste(true)
    setServerError(null)
    setFieldErrors({})
    setDone(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const result = createLaporanSchema.safeParse(values)
    if (!result.success) {
      const errs: Partial<Record<keyof CreateLaporanInput, string>> = {}
      result.error.issues.forEach((err) => { errs[err.path[0] as keyof CreateLaporanInput] = err.message })
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    const reguUlpId = selectedRegu?.ulp_id ?? ulpId
    const res = await fetch('/api/callback/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result.data, ulp_id: reguUlpId }),
    })
    const json = await res.json() as { data: { id: string; magic_token: string } | null; error: string | null }
    setLoading(false)

    if (!res.ok || json.error) {
      setServerError(json.error ?? 'Gagal menyimpan laporan')
      return
    }

    const magicToken = json.data?.magic_token ?? ''
    const base = process.env.NEXT_PUBLIC_ANTRIAN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const linkAntrian = magicToken ? `${base}/antrian/${magicToken}` : ''
    const nomorWa = formatNomorWa(result.data.nomor_pelanggan ?? '')

    // Buka WA ke pelanggan
    if (nomorWa.length >= 10) {
      const pesan = applyTemplate(template, {
        nama: result.data.nama_pelanggan, nomor_tiket: result.data.nomor_tiket,
        lokasi: result.data.lokasi, regu: namaRegu, ulp: reguUlpNama,
        keterangan: result.data.keterangan ?? '', link_antrian: linkAntrian, no_hp: nomorHpRegu,
      })
      window.open(`https://wa.me/${nomorWa}?text=${encodeURIComponent(pesan)}`, '_blank')
    }

    setDone({ values: result.data, namaRegu, magicToken, nomorHpRegu, reguUlpNama })
  }

  return (
    <Modal open={open} onClose={handleClose} title="➕ Tambah Laporan" size="md">
      {done ? (
        <DoneState
          values={done.values}
          namaRegu={done.namaRegu}
          magicToken={done.magicToken}
          nomorHpRegu={done.nomorHpRegu}
          ulpNama={done.reguUlpNama}
          template={template}
          onReset={reset}
          onClose={handleClose}
        />
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Paste APKT */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', backgroundColor: 'var(--accent-subtle)' }}>
            <button
              type="button"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowPaste((p) => !p)}
            >
              <span>📋 Paste dari APKT</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>{showPaste ? '▲' : '▼'}</span>
            </button>
            {showPaste && (
              <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  rows={3}
                  placeholder="Copy baris dari tabel APKT, lalu paste di sini..."
                  value={pasteText}
                  onChange={(e) => handlePaste(e.target.value)}
                  className="input"
                  style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
                />
                {values.created_at && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, margin: 0 }}>
                    ⏱ Waktu APKT: {new Date(values.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Form akan terisi otomatis dari data yang di-paste.</p>
              </div>
            )}
          </div>

          {/* Nomor Tiket */}
          <Input
            label="Nomor Tiket *"
            placeholder="G441550xxx"
            value={values.nomor_tiket}
            onChange={(e) => set('nomor_tiket', e.target.value)}
            error={fieldErrors.nomor_tiket}
          />

          {/* Regu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Regu *</label>
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
            {fieldErrors.regu_id && <p style={{ fontSize: 12, color: '#E4002B', marginTop: 2, fontWeight: 500 }}>{fieldErrors.regu_id}</p>}
          </div>

          {/* Status badge (fixed) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Status</label>
            <span className="badge status-penugasan-regu" style={{ fontSize: 12, padding: '4px 12px' }}>👷 Penugasan Regu</span>
          </div>

          {/* Field lainnya */}
          <Input
            label="Nama Pelanggan *"
            placeholder="Budi Santoso"
            value={values.nama_pelanggan}
            onChange={(e) => set('nama_pelanggan', e.target.value)}
            error={fieldErrors.nama_pelanggan}
          />
          <Input
            label="Nomor Pelanggan"
            placeholder="081234567890"
            value={values.nomor_pelanggan ?? ''}
            onChange={(e) => set('nomor_pelanggan', e.target.value || null)}
            error={fieldErrors.nomor_pelanggan}
            hint="Digunakan untuk buka WhatsApp ke pelanggan"
          />
          <Input
            label="Lokasi *"
            placeholder="Jl. Merdeka No. 10"
            value={values.lokasi}
            onChange={(e) => set('lokasi', e.target.value)}
            error={fieldErrors.lokasi}
          />
          <Textarea
            label="Keterangan"
            placeholder="Keterangan tambahan..."
            rows={2}
            value={values.keterangan ?? ''}
            onChange={(e) => set('keterangan', e.target.value || null)}
            error={fieldErrors.keterangan}
          />

          {serverError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)' }}>
              <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>⚠ {serverError}</p>
            </div>
          )}

          <Button type="submit" variant="primary" size="md" style={{ width: '100%' }} loading={loading}>
            Simpan &amp; Buka WhatsApp →
          </Button>
        </form>
      )}
    </Modal>
  )
}
