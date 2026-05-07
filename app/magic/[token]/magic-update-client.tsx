'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { STATUS_LABEL, STATUS_COLOR } from '@/constants'
import type { StatusLaporan, MagicLinkLaporan } from '@/types'

const STATUS_OPTIONS: { value: StatusLaporan; label: string; color: string; textColor: string }[] = [
  { value: 'ditangani', label: '🟡 Sedang Ditangani', color: '#0070C0', textColor: '#fff' },
  { value: 'nyala_sementara', label: '🟠 Nyala Sementara (Hold)', color: '#FFD200', textColor: '#1A1A1A' },
  { value: 'selesai', label: '✅ Selesai', color: '#1DB954', textColor: '#fff' },
]

interface Props {
  laporan: MagicLinkLaporan
  token: string
}

export function MagicUpdateClient({ laporan, token }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<StatusLaporan | null>(null)
  const [keterangan, setKeterangan] = useState(laporan.keterangan ?? '')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!selectedStatus) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/magic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status: selectedStatus, keterangan: keterangan || null }),
    })

    const json = await res.json()
    if (!res.ok || json.error) {
      setError(json.error ?? 'Gagal update status')
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) {
    const color = STATUS_COLOR[selectedStatus!]
    return (
      <div
        className="neo-card p-6 text-center"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        <p className="font-black text-xl">Status Diperbarui!</p>
        <p className="font-bold text-lg mt-1">{STATUS_LABEL[selectedStatus!]}</p>
        {keterangan && <p className="text-sm opacity-80 mt-2 italic">"{keterangan}"</p>}
        <p className="text-xs opacity-70 mt-3">Terima kasih, data sudah tercatat.</p>
      </div>
    )
  }

  return (
    <div className="neo-card p-4">
      <h2 className="font-black text-neo-black mb-3">Pilih Status Baru</h2>

      <div className="flex flex-col gap-2 mb-4">
        {STATUS_OPTIONS.filter((opt) => opt.value !== laporan.status).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelectedStatus(opt.value)}
            className="neo-button w-full py-3 text-left px-4 font-bold text-sm"
            style={{
              backgroundColor: selectedStatus === opt.value ? opt.color : '#FFFFFF',
              color: selectedStatus === opt.value ? opt.textColor : '#1A1A1A',
              borderColor: opt.color,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Textarea
        label="Keterangan (opsional)"
        placeholder="Contoh: sedang dalam perjalanan, pelanggan tidak ada di rumah..."
        rows={3}
        value={keterangan}
        onChange={(e) => setKeterangan(e.target.value)}
      />

      {error && (
        <div className="neo-border mt-3 p-2 border-pln-red!" style={{ backgroundColor: '#FFF5F5' }}>
          <p className="text-sm font-medium text-pln-red">{error}</p>
        </div>
      )}

      <Button
        className="w-full mt-4"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!selectedStatus}
        onClick={handleSubmit}
      >
        Simpan Update
      </Button>
    </div>
  )
}
