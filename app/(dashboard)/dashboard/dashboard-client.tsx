'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ReguCard } from '@/components/dashboard/regu-card'
import { Modal } from '@/components/ui/modal'
import { LaporanForm } from '@/components/laporan/laporan-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { useRealtimeLaporan } from '@/hooks/use-realtime-laporan'
import { STATUS_LABEL, SHIFT_LABEL, SHIFT_JAM } from '@/constants'
import type { Laporan, Regu, Petugas, Piket, ReguStats, ShiftType, StatusLaporan } from '@/types'
import type { CreateLaporanInput } from '@/lib/validations/laporan'

interface UlpInfo {
  id: string
  nama: string
  kode: string
  wa_grup_id: string | null
}

interface UlpData {
  ulp: UlpInfo
  piket: (Piket & { shift_type: { id: string; nama: ShiftType; jam_mulai: string; jam_selesai: string } }) | null
  reguList: Regu[]
  petugasList: Petugas[]
  laporanList: Laporan[]
}

interface Props {
  ulpDataList: UlpData[]
  today: string
}

interface AddModalCtx {
  reguId: string
  ulpId: string
  piketId: string | null
  reguList: Regu[]
}

export function DashboardClient({ ulpDataList, today }: Props) {
  const router = useRouter()

  const [laporanMap, setLaporanMap] = useState<Record<string, Laporan[]>>(
    () => Object.fromEntries(ulpDataList.map((d) => [d.ulp.id, d.laporanList]))
  )

  const [addModal, setAddModal] = useState<AddModalCtx | null>(null)
  const [updateModal, setUpdateModal] = useState<Laporan | null>(null)
  const [updateStatus, setUpdateStatus] = useState<StatusLaporan>('lapor')
  const [updateKeterangan, setUpdateKeterangan] = useState('')
  const [updating, setUpdating] = useState(false)
  const [sendingWa, setSendingWa] = useState<string | null>(null)
  const [sendingRekap, setSendingRekap] = useState<string | null>(null)
  const [waktu, setWaktu] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setWaktu(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const ulpIds = ulpDataList.map((d) => d.ulp.id)

  const handleRealtimeInsert = useCallback((laporan: Laporan) => {
    setLaporanMap((prev) => {
      const existing = prev[laporan.ulp_id] ?? []
      if (existing.some((l) => l.id === laporan.id)) return prev
      return { ...prev, [laporan.ulp_id]: [laporan, ...existing] }
    })
  }, [])

  const handleRealtimeUpdate = useCallback((laporan: Laporan) => {
    setLaporanMap((prev) => {
      const existing = prev[laporan.ulp_id] ?? []
      return { ...prev, [laporan.ulp_id]: existing.map((l) => l.id === laporan.id ? laporan : l) }
    })
  }, [])

  useRealtimeLaporan({ ulpIds, onInsert: handleRealtimeInsert, onUpdate: handleRealtimeUpdate })

  function openAddLaporan(reguId: string, ulpId: string, piketId: string | null, reguList: Regu[]) {
    setAddModal({ reguId, ulpId, piketId, reguList })
  }

  function openUpdateLaporan(laporan: Laporan) {
    setUpdateModal(laporan)
    setUpdateStatus(laporan.status)
    setUpdateKeterangan(laporan.keterangan ?? '')
  }

  function closeUpdateModal() {
    setUpdateModal(null)
    setUpdateKeterangan('')
  }

  const handleAddLaporan = useCallback(async (data: CreateLaporanInput): Promise<{ error?: string }> => {
    if (!addModal) return { error: 'No context' }
    const res = await fetch('/api/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ulp_id: addModal.ulpId, piket_id: addModal.piketId }),
    })
    const json = await res.json()
    if (!res.ok || json.error) return { error: json.error ?? 'Gagal menyimpan laporan' }
    setLaporanMap((prev) => ({
      ...prev,
      [addModal.ulpId]: [json.data, ...(prev[addModal.ulpId] ?? [])],
    }))
    setAddModal(null)
    return {}
  }, [addModal])

  async function handleSubmitUpdate() {
    if (!updateModal) return
    setUpdating(true)
    const res = await fetch(`/api/laporan/${updateModal.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: updateStatus, keterangan: updateKeterangan || null }),
    })
    const json = await res.json()
    if (res.ok && json.data) {
      const ulpId = updateModal.ulp_id
      setLaporanMap((prev) => ({
        ...prev,
        [ulpId]: (prev[ulpId] ?? []).map((l) => l.id === updateModal.id ? json.data : l),
      }))
    }
    setUpdating(false)
    closeUpdateModal()
  }

  async function handleKirimWa(reguId: string) {
    const ulpData = ulpDataList.find((d) => d.reguList.some((r) => r.id === reguId))
    if (!ulpData) return
    setSendingWa(reguId)
    await fetch('/api/wa/kirim-regu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regu_id: reguId, ulp_id: ulpData.ulp.id, piket_id: ulpData.piket?.id ?? null }),
    })
    setSendingWa(null)
  }

  async function handleRekap(ulpId: string, piketId: string) {
    setSendingRekap(ulpId)
    await fetch('/api/wa/rekap-piket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulp_id: ulpId, piket_id: piketId }),
    })
    setSendingRekap(null)
  }

  return (
    <div className="flex flex-col overflow-hidden bg-neo-white" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* ULP Sections — flex column, each takes equal height */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {ulpDataList.map(({ ulp, piket, reguList, petugasList }) => {
          const laporan = laporanMap[ulp.id] ?? []
          const uniqueLaporan = Array.from(new Map(laporan.map((l) => [l.id, l])).values())

          const reguStats: ReguStats[] = reguList.map((regu) => {
            const regPetugas = petugasList.filter((p) => p.regu_id === regu.id)
            const regLaporan = uniqueLaporan.filter((l) => l.regu_id === regu.id)
            return {
              regu,
              petugas: regPetugas,
              laporan: regLaporan,
              total: regLaporan.length,
              lapor: regLaporan.filter((l) => l.status === 'lapor').length,
              ditangani: regLaporan.filter((l) => l.status === 'ditangani').length,
              nyala_sementara: regLaporan.filter((l) => l.status === 'nyala_sementara').length,
              selesai: regLaporan.filter((l) => l.status === 'selesai').length,
            }
          })

          const totalLapor = reguStats.reduce((s, r) => s + r.lapor, 0)
          const totalDitangani = reguStats.reduce((s, r) => s + r.ditangani, 0)
          const totalNyalaSementara = reguStats.reduce((s, r) => s + r.nyala_sementara, 0)
          const totalSelesai = reguStats.reduce((s, r) => s + r.selesai, 0)

          const n = reguList.length
          const gridCols = n <= 6 ? `grid-cols-${n}` : 'grid-cols-6'

          return (
            <div key={ulp.id} className="flex-1 min-h-0 flex flex-col border-b-2 border-neo-black last:border-b-0">
              {/* Combined Header */}
              <div
                className="flex items-center justify-between px-3 py-2 border-b-2 border-neo-black shrink-0"
                style={{ backgroundColor: '#003B8E' }}
              >
                {/* Left: app icon + ULP + shift info */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">⚡</span>
                  <span className="text-white font-black text-sm shrink-0">{ulp.nama.toUpperCase()}</span>
                  {piket ? (
                    <>
                      <span
                        className="px-2 py-0.5 text-xs font-black shrink-0"
                        style={{ backgroundColor: '#FFD200', color: '#1A1A1A' }}
                      >
                        {SHIFT_LABEL[piket.shift_type.nama as ShiftType].replace('Shift ', '')}
                      </span>
                      <span className="text-blue-100 text-xs font-medium shrink-0">
                        {SHIFT_JAM[piket.shift_type.nama as ShiftType].mulai}–{SHIFT_JAM[piket.shift_type.nama as ShiftType].selesai}
                      </span>
                      {piket.nama_cc && (
                        <span className="text-blue-200 text-xs hidden lg:block truncate">CC: {piket.nama_cc}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-blue-200 text-xs italic">Belum ada piket</span>
                  )}
                </div>

                {/* Right: clock + date + stats + rekap */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden md:block">
                    <div className="text-white font-mono text-sm font-black leading-none" suppressHydrationWarning>
                      {waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="text-blue-200 text-xs leading-none mt-0.5">
                      {waktu.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <UlpStatChip label="L" value={totalLapor} bg="#E4002B" />
                    <UlpStatChip label="P" value={totalDitangani} bg="#0070C0" bordered />
                    <UlpStatChip label="H" value={totalNyalaSementara} bg="#FFD200" textDark />
                    <UlpStatChip label="S" value={totalSelesai} bg="#1DB954" />
                  </div>
                  {piket && (
                    <button
                      disabled={sendingRekap === ulp.id}
                      onClick={() => handleRekap(ulp.id, piket.id)}
                      className="px-2 py-0.5 text-xs font-bold border border-white/40 text-white hover:opacity-80 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: '#1DB954' }}
                    >
                      {sendingRekap === ulp.id ? '...' : '📊 Rekap'}
                    </button>
                  )}
                </div>
              </div>

              {/* Regu Grid or No-Piket State */}
              {!piket ? (
                <div className="flex-1 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm font-bold text-neo-black">Belum ada piket aktif</p>
                      <button
                        className="mt-1 text-xs text-pln-blue underline"
                        onClick={() => router.push('/piket')}
                      >
                        Buat piket
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 relative overflow-hidden">
                  <div
                    className={`absolute inset-0 grid ${gridCols} divide-x-2 divide-neo-black`}
                    style={{ gridTemplateRows: '1fr' }}
                  >
                    {reguStats.map((stats) => (
                      <div key={stats.regu.id} className="h-full overflow-hidden flex flex-col">
                        <ReguCard
                          stats={stats}
                          onAddLaporan={(reguId) => openAddLaporan(reguId, ulp.id, piket.id, reguList)}
                          onKirimWa={handleKirimWa}
                          onUpdateLaporan={openUpdateLaporan}
                          sendingWa={sendingWa === stats.regu.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Laporan Modal */}
      <Modal open={!!addModal} onClose={() => setAddModal(null)} title="Input Laporan Baru">
        {addModal && (
          <LaporanForm
            reguList={addModal.reguList}
            defaultReguId={addModal.reguId}
            onSubmit={handleAddLaporan}
            onCancel={() => setAddModal(null)}
          />
        )}
      </Modal>

      {/* Update Status Modal */}
      <Modal
        open={!!updateModal}
        onClose={closeUpdateModal}
        title={`Update Status — #${updateModal?.nomor_tiket ?? ''}`}
      >
        {updateModal && (
          <div className="flex flex-col gap-4 min-w-72">
            <div className="neo-border p-3 bg-neo-gray text-sm flex flex-col gap-1">
              <p className="font-bold text-neo-black">{updateModal.nama_pelanggan}</p>
              <p className="text-gray-600 text-xs">{updateModal.lokasi}</p>
              <div className="mt-1">
                <StatusBadge status={updateModal.status} size="sm" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-neo-black">Status Baru</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STATUS_LABEL) as [StatusLaporan, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setUpdateStatus(val)}
                    className={`neo-button px-3 py-2 text-xs font-bold text-left transition-all ${
                      updateStatus === val
                        ? 'bg-pln-blue text-white'
                        : 'bg-neo-white text-neo-black hover:bg-neo-gray'
                    }`}
                  >
                    {updateStatus === val ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="Keterangan"
              placeholder="Keterangan update... (opsional)"
              rows={2}
              value={updateKeterangan}
              onChange={(e) => setUpdateKeterangan(e.target.value)}
            />

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={closeUpdateModal}>
                Batal
              </Button>
              <Button variant="primary" className="flex-1" loading={updating} onClick={handleSubmitUpdate}>
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function UlpStatChip({
  label, value, bg, textDark, bordered,
}: { label: string; value: number; bg: string; textDark?: boolean; bordered?: boolean }) {
  return (
    <div
      className={`px-1.5 py-0.5 text-xs font-black leading-none border ${bordered ? 'border-white/40' : 'border-transparent'}`}
      style={{ backgroundColor: bg, color: textDark ? '#1A1A1A' : '#fff' }}
    >
      {value} {label}
    </div>
  )
}
