'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShiftHeader } from '@/components/dashboard/shift-header'
import { ReguCard } from '@/components/dashboard/regu-card'
import { Modal } from '@/components/ui/modal'
import { LaporanForm } from '@/components/laporan/laporan-form'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { useRealtimeLaporan } from '@/hooks/use-realtime-laporan'
import { STATUS_LABEL } from '@/constants'
import type { Laporan, Regu, Petugas, Piket, Profile, ReguStats, ShiftType, StatusLaporan } from '@/types'
import type { CreateLaporanInput } from '@/lib/validations/laporan'

interface Props {
  profile: Profile & { ulp: { id: string; nama: string; kode: string; wa_grup_id: string | null } }
  piketList: (Piket & { shift_type: { id: string; nama: ShiftType; jam_mulai: string; jam_selesai: string } })[]
  reguList: Regu[]
  petugasList: Petugas[]
  laporanList: Laporan[]
  today: string
}

export function DashboardClient({ profile, piketList, reguList, petugasList, laporanList: initialLaporan, today }: Props) {
  const router = useRouter()
  const [laporanList, setLaporanList] = useState<Laporan[]>(initialLaporan)

  // Add laporan modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedReguId, setSelectedReguId] = useState<string | undefined>()

  // Update status modal
  const [updateModal, setUpdateModal] = useState<Laporan | null>(null)
  const [updateStatus, setUpdateStatus] = useState<StatusLaporan>('lapor')
  const [updateKeterangan, setUpdateKeterangan] = useState('')
  const [updating, setUpdating] = useState(false)

  // WA sending state
  const [sendingWa, setSendingWa] = useState<string | null>(null)
  const [sendingRekap, setSendingRekap] = useState(false)

  const currentPiket = piketList[0]

  const uniqueLaporan = Array.from(new Map(laporanList.map((l) => [l.id, l])).values())

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

  function openAddLaporan(reguId: string) {
    setSelectedReguId(reguId)
    setAddModalOpen(true)
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

  const handleRealtimeInsert = useCallback((laporan: Laporan) => {
    setLaporanList((prev) => {
      if (prev.some((l) => l.id === laporan.id)) return prev
      return [laporan, ...prev]
    })
  }, [])

  const handleRealtimeUpdate = useCallback((laporan: Laporan) => {
    setLaporanList((prev) => prev.map((l) => (l.id === laporan.id ? laporan : l)))
  }, [])

  useRealtimeLaporan({
    ulpId: profile.ulp.id,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
  })

  const handleAddLaporan = useCallback(async (data: CreateLaporanInput): Promise<{ error?: string }> => {
    const res = await fetch('/api/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ulp_id: profile.ulp.id, piket_id: currentPiket?.id ?? null }),
    })

    const json = await res.json()
    if (!res.ok || json.error) return { error: json.error ?? 'Gagal menyimpan laporan' }

    setLaporanList((prev) => [json.data, ...prev])
    setAddModalOpen(false)
    return {}
  }, [profile.ulp.id, currentPiket?.id])

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
      setLaporanList((prev) => prev.map((l) => (l.id === updateModal.id ? json.data : l)))
    }
    setUpdating(false)
    closeUpdateModal()
  }

  async function handleKirimWa(reguId: string) {
    setSendingWa(reguId)
    await fetch('/api/wa/kirim-regu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regu_id: reguId, ulp_id: profile.ulp.id, piket_id: currentPiket?.id ?? null }),
    })
    setSendingWa(null)
  }

  async function handleRekap() {
    setSendingRekap(true)
    await fetch('/api/wa/rekap-piket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulp_id: profile.ulp.id, piket_id: currentPiket?.id }),
    })
    setSendingRekap(false)
  }

  if (!currentPiket) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b-2 border-neo-black" style={{ backgroundColor: '#003B8E' }}>
          <h1 className="text-white font-black text-xl">⚡ MONITORING APKT — {profile.ulp.nama}</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-bold text-neo-black">Belum ada piket aktif hari ini</p>
          <p className="text-sm text-gray-500">Buat piket terlebih dahulu di halaman Piket</p>
          <Button variant="primary" onClick={() => router.push('/piket')}>
            Buat Piket Hari Ini
          </Button>
        </div>
      </div>
    )
  }

  const gridCols = reguList.length <= 3 ? `grid-cols-${reguList.length}` :
    reguList.length === 4 ? 'grid-cols-4' :
    reguList.length === 5 ? 'grid-cols-5' : 'grid-cols-6'

  return (
    <div className="h-full flex flex-col overflow-hidden bg-neo-white">
      {/* Header */}
      <ShiftHeader
        piket={currentPiket as never}
        totalLapor={totalLapor}
        totalDitangani={totalDitangani}
        totalNyalaSementara={totalNyalaSementara}
        totalSelesai={totalSelesai}
      />

      {/* Regu Grid */}
      <div className={`flex-1 grid ${gridCols} gap-0 overflow-hidden`}>
        {reguStats.map((stats, idx) => (
          <div
            key={stats.regu.id}
            className={`flex flex-col overflow-hidden border-r-2 border-neo-black ${idx === reguStats.length - 1 ? 'border-r-0' : ''}`}
          >
            <ReguCard
              stats={stats}
              onAddLaporan={openAddLaporan}
              onKirimWa={handleKirimWa}
              onUpdateLaporan={openUpdateLaporan}
              sendingWa={sendingWa === stats.regu.id}
            />
          </div>
        ))}
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t-2 border-neo-black bg-neo-gray">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <span className="w-2 h-2 rounded-full bg-pln-green inline-block" />
          {profile.nama} · {profile.role.toUpperCase()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/settings')}
          >
            ⚙ Pengaturan
          </Button>
          <Button
            variant="yellow"
            size="sm"
            loading={sendingRekap}
            onClick={handleRekap}
          >
            📊 Rekap Piket → WA
          </Button>
        </div>
      </div>

      {/* Add Laporan Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Input Laporan Baru"
      >
        <LaporanForm
          reguList={reguList}
          defaultReguId={selectedReguId}
          onSubmit={handleAddLaporan}
          onCancel={() => setAddModalOpen(false)}
        />
      </Modal>

      {/* Update Status Modal */}
      <Modal
        open={!!updateModal}
        onClose={closeUpdateModal}
        title={`Update Status — #${updateModal?.nomor_tiket ?? ''}`}
      >
        {updateModal && (
          <div className="flex flex-col gap-4 min-w-72">
            {/* Info laporan */}
            <div className="neo-border p-3 bg-neo-gray text-sm flex flex-col gap-1">
              <p className="font-bold text-neo-black">{updateModal.nama_pelanggan}</p>
              <p className="text-gray-600 text-xs">{updateModal.lokasi}</p>
              <div className="mt-1">
                <StatusBadge status={updateModal.status} size="sm" />
              </div>
            </div>

            {/* Status selector — tampil sebagai grid tombol */}
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
