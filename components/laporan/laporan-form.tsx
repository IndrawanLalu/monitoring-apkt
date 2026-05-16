'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { createLaporanSchema, type CreateLaporanInput } from '@/lib/validations/laporan'
import type { Regu } from '@/types'

interface LaporanFormProps {
  reguList: Regu[]
  defaultReguId?: string
  onSubmit: (data: CreateLaporanInput) => Promise<{ error?: string }>
  onCancel: () => void
}

function parseApktDurasi(durasi: string): number {
  // Format: "D - HH:MM:SS"
  const match = durasi.trim().match(/^(\d+)\s*-\s*(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return 0
  const [, d, h, m, s] = match.map(Number)
  return d * 86400 + h * 3600 + m * 60 + s
}

function parseApkt(text: string): Partial<CreateLaporanInput> {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  const result: Partial<CreateLaporanInput> = {}

  for (const line of lines) {
    // Nomor tiket: baris yang dimulai dengan G diikuti angka
    if (/^G\d{10,}/.test(line)) {
      result.nomor_tiket = line.trim()
      continue
    }

    // Baris data tab-separated
    const cols = line.split('\t')
    if (cols.length >= 4) {
      // col 0: nama pelanggan
      // col 1: durasi APKT (D - HH:MM:SS)
      // col 2: status APKT → mapping ke status kita
      // col 3: lokasi primer
      // col 4: lokasi sekunder — skip
      // col 5: posko — skip
      // col 6: nomor HP
      // col 7: keterangan
      if (cols[0]?.trim()) result.nama_pelanggan = cols[0].trim()

      const apktStatus = cols[2]?.trim().toLowerCase() ?? ''
      if (apktStatus.includes('nyala sementara')) result.status = 'nyala_sementara'
      else if (apktStatus === 'nyala') result.status = 'selesai'
      else if (['penugasan regu', 'dalam perjalanan', 'dalam pengerjaan'].includes(apktStatus)) result.status = 'ditangani'
      else result.status = 'lapor'

      if (cols[3]?.trim()) result.lokasi = cols[3].trim()
      if (cols[6]?.trim()) result.nomor_pelanggan = cols[6].trim()
      if (cols[7]?.trim()) result.keterangan = cols[7].trim()

      // Hitung created_at dari durasi APKT
      if (cols[1]?.trim()) {
        const detik = parseApktDurasi(cols[1].trim())
        if (detik > 0) {
          result.created_at = new Date(Date.now() - detik * 1000).toISOString()
        }
      }
    }
  }

  return result
}

export function LaporanForm({ reguList, defaultReguId, onSubmit, onCancel }: LaporanFormProps) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateLaporanInput, string>>>({})
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(true)

  const [values, setValues] = useState<CreateLaporanInput>({
    nomor_tiket: '',
    regu_id: defaultReguId ?? '',
    nama_pelanggan: '',
    nomor_pelanggan: '',
    lokasi: '',
    keterangan: '',
    created_at: undefined,
    status: 'lapor',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const result = createLaporanSchema.safeParse(values)
    if (!result.success) {
      const errors: Partial<Record<keyof CreateLaporanInput, string>> = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof CreateLaporanInput
        errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    const { error } = await onSubmit(result.data)
    if (error) {
      setServerError(error)
      setLoading(false)
      return
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Paste dari APKT */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', backgroundColor: 'var(--accent-subtle)' }}>
        <button
          type="button"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => setShowPaste((v) => !v)}
        >
          <span>📋 Paste dari APKT</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{showPaste ? '▲' : '▼'}</span>
        </button>
        {showPaste && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                ⏱ Waktu lapor APKT: {new Date(values.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (durasi dihitung dari APKT)
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Form akan terisi otomatis dari data yang di-paste.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input
            label="Nomor Tiket *"
            placeholder="G441550xxx"
            value={values.nomor_tiket}
            onChange={(e) => set('nomor_tiket', e.target.value)}
            error={fieldErrors.nomor_tiket}
          />
        </div>

        <div className="col-span-2">
          <Select
            label="Regu *"
            value={values.regu_id}
            onChange={(e) => set('regu_id', e.target.value)}
            error={fieldErrors.regu_id}
          >
            <option value="">Pilih regu...</option>
            {reguList.map((regu) => (
              <option key={regu.id} value={regu.id}>
                {regu.nama}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2">
          <Select
            label="Status Awal"
            value={values.status ?? 'lapor'}
            onChange={(e) => set('status', e.target.value as CreateLaporanInput['status'])}
          >
            <option value="lapor">Lapor</option>
            <option value="ditangani">Sedang Ditangani</option>
            <option value="nyala_sementara">Nyala Sementara</option>
            <option value="selesai">Selesai</option>
          </Select>
        </div>

        <div className="col-span-2">
          <Input
            label="Nama Pelanggan *"
            placeholder="Budi Santoso"
            value={values.nama_pelanggan}
            onChange={(e) => set('nama_pelanggan', e.target.value)}
            error={fieldErrors.nama_pelanggan}
          />
        </div>

        <div className="col-span-2">
          <Input
            label="Nomor Pelanggan"
            placeholder="081234567890"
            value={values.nomor_pelanggan ?? ''}
            onChange={(e) => set('nomor_pelanggan', e.target.value || null)}
            error={fieldErrors.nomor_pelanggan}
          />
        </div>

        <div className="col-span-2">
          <Input
            label="Lokasi *"
            placeholder="Jl. Merdeka No. 10"
            value={values.lokasi}
            onChange={(e) => set('lokasi', e.target.value)}
            error={fieldErrors.lokasi}
          />
        </div>

        <div className="col-span-2">
          <Textarea
            label="Keterangan"
            placeholder="Keterangan tambahan..."
            rows={3}
            value={values.keterangan ?? ''}
            onChange={(e) => set('keterangan', e.target.value || null)}
            error={fieldErrors.keterangan}
          />
        </div>
      </div>

      {serverError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)' }}>
          <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>⚠ {serverError}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" size="md" className="flex-1" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" variant="primary" size="md" className="flex-1" loading={loading}>
          Simpan & Kirim WA
        </Button>
      </div>
    </form>
  )
}
