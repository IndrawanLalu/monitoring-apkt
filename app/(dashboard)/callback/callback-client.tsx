'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { createLaporanSchema, type CreateLaporanInput } from '@/lib/validations/laporan'

interface ReguItem {
  id: string
  ulp_id: string
  nama: string
  created_at: string
  ulpNama: string
}

interface Props {
  reguList: ReguItem[]
  ulpId: string
  ulpNama: string
  template: string
}

// ── APKT paste parser ─────────────────────────────────────────────────────────

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

// ── WA helpers ────────────────────────────────────────────────────────────────

function formatNomorWa(nomor: string): string {
  const clean = nomor.replace(/\D/g, '')
  if (clean.startsWith('62')) return clean
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  return '62' + clean
}

function applyTemplate(tpl: string, v: { nama: string; nomor_tiket: string; lokasi: string; regu: string; ulp: string; keterangan: string; link_antrian: string }) {
  return tpl
    .replace(/\{nama\}/g, v.nama || '...')
    .replace(/\{nomor_tiket\}/g, v.nomor_tiket || '...')
    .replace(/\{lokasi\}/g, v.lokasi || '...')
    .replace(/\{regu\}/g, v.regu || '...')
    .replace(/\{ulp\}/g, v.ulp)
    .replace(/\{keterangan\}/g, v.keterangan || '-')
    .replace(/\{link_antrian\}/g, v.link_antrian || '')
}

// ── Preview WA ────────────────────────────────────────────────────────────────

function WaPreview({ pesan, nomorHp }: { pesan: string; nomorHp: string }) {
  const nomorWa = formatNomorWa(nomorHp)
  const valid = nomorWa.length >= 10
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-base">📱</span>
        <h2 className="font-black text-sm text-neo-black uppercase tracking-wide">Preview Pesan WA</h2>
      </div>
      <div className="flex-1 bg-[#ECE5DD] border-2 border-neo-black p-3 overflow-y-auto min-h-0">
        <div className="flex justify-end">
          <div className="bg-[#DCF8C6] border border-[#b2dfb2] rounded-tl-xl rounded-bl-xl rounded-br-xl px-3 py-2 max-w-[90%] shadow-sm">
            <p className="text-xs text-neo-black whitespace-pre-wrap leading-relaxed">
              {pesan.split('\n').map((line, i, arr) => {
                const parts = line.split(/(\*[^*]+\*)/g)
                return (
                  <span key={i}>
                    {parts.map((p, j) =>
                      p.startsWith('*') && p.endsWith('*')
                        ? <strong key={j}>{p.slice(1, -1)}</strong>
                        : <span key={j}>{p}</span>
                    )}
                    {i < arr.length - 1 && <br />}
                  </span>
                )
              })}
            </p>
            <p className="text-[10px] text-gray-400 text-right mt-1">
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
      <div className="shrink-0 space-y-2">
        <p className="text-xs text-gray-500 font-medium">
          Kirim ke:{' '}
          <span className={valid ? 'text-neo-black font-bold' : 'text-pln-red font-bold'}>
            {valid ? `+${nomorWa}` : 'Nomor belum diisi'}
          </span>
        </p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Template bisa diubah di{' '}
          <span className="font-bold text-gray-500">Pengaturan → Template Callback</span>.{' '}
          Var: <code className="bg-neo-gray px-0.5">{'{nama}'}</code>{' '}
          <code className="bg-neo-gray px-0.5">{'{nomor_tiket}'}</code>{' '}
          <code className="bg-neo-gray px-0.5">{'{lokasi}'}</code>{' '}
          <code className="bg-neo-gray px-0.5">{'{regu}'}</code>{' '}
          <code className="bg-neo-gray px-0.5">{'{ulp}'}</code>{' '}
          <code className="bg-neo-gray px-0.5">{'{keterangan}'}</code>{' '}
          <code className="bg-neo-gray px-0.5">{'{link_antrian}'}</code>
        </p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CallbackClient({ reguList, ulpId, ulpNama, template }: Props) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateLaporanInput, string>>>({})
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(true)
  const [done, setDone] = useState<{ values: CreateLaporanInput; namaRegu: string; magicToken: string } | null>(null)
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

  const namaRegu = reguList.find((r) => r.id === values.regu_id)?.nama ?? ''

  const pesanWa = useMemo(() =>
    applyTemplate(template, {
      nama: values.nama_pelanggan, nomor_tiket: values.nomor_tiket,
      lokasi: values.lokasi, regu: namaRegu, ulp: ulpNama, keterangan: values.keterangan ?? '',
      link_antrian: '[link antrian]',
    }),
    [template, values.nama_pelanggan, values.nomor_tiket, values.lokasi, namaRegu, ulpNama, values.keterangan],
  )

  function bukaWa(v: CreateLaporanInput, nama: string, magicToken = '') {
    const nomor = formatNomorWa(v.nomor_pelanggan ?? '')
    if (!nomor || nomor.length < 10) return
    const linkAntrian = magicToken ? `${process.env.NEXT_PUBLIC_ANTRIAN_BASE_URL || window.location.origin}/antrian/${magicToken}` : ''
    const pesan = applyTemplate(template, {
      nama: v.nama_pelanggan, nomor_tiket: v.nomor_tiket,
      lokasi: v.lokasi, regu: nama, ulp: ulpNama, keterangan: v.keterangan ?? '',
      link_antrian: linkAntrian,
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
      setFieldErrors(errs)
      return
    }
    setLoading(true)
    const res = await fetch('/api/callback/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result.data, ulp_id: ulpId }),
    })
    const json = await res.json() as { data: { id: string; nomor_tiket: string; status: string; magic_token: string } | null; error: string | null }
    setLoading(false)
    if (!res.ok || json.error) { setServerError(json.error ?? 'Gagal menyimpan laporan'); return }
    const magicToken = json.data?.magic_token ?? ''
    setDone({ values: result.data, namaRegu, magicToken })
    bukaWa(result.data, namaRegu, magicToken)
  }

  if (done) {
    const { values: v, namaRegu: nr, magicToken: mt } = done
    const nomorWa = formatNomorWa(v.nomor_pelanggan ?? '')
    const nomorValid = nomorWa.length >= 10
    const base = process.env.NEXT_PUBLIC_ANTRIAN_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    const linkAntrian = mt ? `${base}/antrian/${mt}` : ''
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <Header ulpNama={ulpNama} />
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4">
            <div className="border-2 border-neo-black bg-neo-white shadow-neo p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">✅</span>
                <div>
                  <p className="font-black text-neo-black">Laporan Tersimpan</p>
                  <p className="text-xs text-gray-400">WhatsApp telah dibuka otomatis</p>
                </div>
              </div>
              <div className="space-y-2 text-sm border-t-2 border-neo-black pt-4">
                {[
                  ['No. Tiket', v.nomor_tiket], ['Pelanggan', v.nama_pelanggan],
                  ['No. HP', nomorValid ? `+${nomorWa}` : '—'], ['Lokasi', v.lokasi],
                  ['Regu', nr], ['Status', v.status ?? 'lapor'],
                  ...(v.keterangan ? [['Keterangan', v.keterangan]] : []),
                ].map(([label, val]) => (
                  <div key={label} className="flex gap-2">
                    <span className="font-bold text-gray-500 w-24 shrink-0">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            {linkAntrian && (
              <div className="border-2 border-neo-black bg-pln-yellow/10 p-3 flex items-center gap-2">
                <span className="text-lg shrink-0">🔢</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-500">Link Antrian Pelanggan</p>
                  <p className="text-xs font-mono text-neo-black truncate">{linkAntrian}</p>
                </div>
                <button
                  onClick={() => void navigator.clipboard.writeText(linkAntrian)}
                  className="shrink-0 text-xs font-bold border border-neo-black px-2 py-1 bg-neo-white hover:bg-neo-gray transition-colors"
                >
                  Salin
                </button>
              </div>
            )}
            <button onClick={() => bukaWa(v, nr, mt)} disabled={!nomorValid}
              className="w-full py-3 font-black text-sm border-2 border-neo-black bg-[#25D366] text-white shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              📲 Buka WhatsApp Lagi
            </button>
            <button onClick={() => {
              setValues({ nomor_tiket: '', regu_id: '', nama_pelanggan: '', nomor_pelanggan: '', lokasi: '', keterangan: '', created_at: undefined, status: 'lapor' })
              setPasteText(''); setShowPaste(true); setDone(null)
            }} className="w-full py-2.5 font-bold text-sm border-2 border-neo-black bg-neo-white shadow-neo-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo transition-all">
              + Input Laporan Baru
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header ulpNama={ulpNama} />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 border-r-2 border-neo-black">
          <form onSubmit={handleSubmit} className="max-w-lg mx-auto flex flex-col gap-4">
            <div className="border-2 border-neo-black bg-pln-yellow/10">
              <button type="button"
                className="w-full flex items-center justify-between px-3 py-2 font-bold text-sm text-neo-black"
                onClick={() => setShowPaste((v) => !v)}>
                <span>📋 Paste dari APKT</span>
                <span className="text-xs opacity-60">{showPaste ? '▲' : '▼'}</span>
              </button>
              {showPaste && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                  <textarea rows={3} placeholder="Copy baris dari tabel APKT, lalu paste di sini..."
                    value={pasteText} onChange={(e) => handlePaste(e.target.value)}
                    className="neo-input w-full px-3 py-2 text-xs font-mono resize-none" />
                  {values.created_at && (
                    <p className="text-xs text-pln-blue font-medium">
                      ⏱ Waktu lapor APKT:{' '}
                      {new Date(values.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">Form akan terisi otomatis dari data yang di-paste.</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Nomor Tiket *" placeholder="G441550xxx" value={values.nomor_tiket}
                  onChange={(e) => set('nomor_tiket', e.target.value)} error={fieldErrors.nomor_tiket} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-bold text-neo-black block mb-1">Regu *</label>
                <select value={values.regu_id} onChange={(e) => set('regu_id', e.target.value)}
                  className="neo-input w-full px-3 py-2 text-sm font-medium">
                  <option value="">Pilih regu...</option>
                  {reguByUlp.map(({ ulpNama: uNama, regus }) => (
                    <optgroup key={uNama} label={uNama}>
                      {regus.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}
                    </optgroup>
                  ))}
                </select>
                {fieldErrors.regu_id && <p className="mt-1 text-xs text-pln-red font-medium">{fieldErrors.regu_id}</p>}
              </div>
              <div className="col-span-2">
                <Select label="Status Awal" value={values.status ?? 'lapor'}
                  onChange={(e) => set('status', e.target.value as CreateLaporanInput['status'])}>
                  <option value="lapor">Lapor</option>
                  <option value="ditangani">Sedang Ditangani</option>
                  <option value="nyala_sementara">Nyala Sementara</option>
                  <option value="selesai">Selesai</option>
                </Select>
              </div>
              <div className="col-span-2">
                <Input label="Nama Pelanggan *" placeholder="Budi Santoso" value={values.nama_pelanggan}
                  onChange={(e) => set('nama_pelanggan', e.target.value)} error={fieldErrors.nama_pelanggan} />
              </div>
              <div className="col-span-2">
                <Input label="Nomor Pelanggan" placeholder="081234567890" value={values.nomor_pelanggan ?? ''}
                  onChange={(e) => set('nomor_pelanggan', e.target.value || null)} error={fieldErrors.nomor_pelanggan}
                  hint="Digunakan untuk buka WhatsApp ke pelanggan" />
              </div>
              <div className="col-span-2">
                <Input label="Lokasi *" placeholder="Jl. Merdeka No. 10" value={values.lokasi}
                  onChange={(e) => set('lokasi', e.target.value)} error={fieldErrors.lokasi} />
              </div>
              <div className="col-span-2">
                <Textarea label="Keterangan" placeholder="Keterangan tambahan..." rows={3}
                  value={values.keterangan ?? ''}
                  onChange={(e) => set('keterangan', e.target.value || null)} error={fieldErrors.keterangan} />
              </div>
            </div>
            {serverError && (
              <div className="border-2 border-pln-red p-3" style={{ backgroundColor: '#FFF5F5' }}>
                <p className="text-sm font-medium text-pln-red">{serverError}</p>
              </div>
            )}
            <Button type="submit" variant="primary" size="md" className="w-full" loading={loading}>
              Simpan & Buka WhatsApp →
            </Button>
          </form>
        </div>
        <div className="w-96 shrink-0 p-5 bg-neo-gray/20 flex flex-col">
          <WaPreview pesan={pesanWa} nomorHp={values.nomor_pelanggan ?? ''} />
        </div>
      </div>
    </div>
  )
}

function Header({ ulpNama }: { ulpNama: string }) {
  return (
    <div className="px-6 py-4 border-b-2 border-neo-black bg-neo-white shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">📞</span>
        <div>
          <h1 className="text-xl font-black text-neo-black uppercase tracking-wide leading-none">CC Callback</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Input laporan dari telepon pelanggan · {ulpNama}
          </p>
        </div>
      </div>
    </div>
  )
}
