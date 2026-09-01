'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ReguCard } from '@/components/dashboard/regu-card'
import { TambahLaporanModal, type ReguForModal } from '@/components/dashboard/tambah-laporan-modal'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { useRealtimeLaporan } from '@/hooks/use-realtime-laporan'
import { STATUS_LABEL, SHIFT_LABEL, SHIFT_JAM } from '@/constants'
import type { Laporan, Regu, Petugas, Piket, ReguStats, ShiftType, StatusLaporan } from '@/types'
import { useKonfirmasi } from '@/components/ui/konfirmasi'

interface UlpInfo {
  id: string
  nama: string
  kode: string
  wa_grup_id: string | null
}

interface UlpData {
  ulp: UlpInfo
  piket: (Piket & { shift_type: { id: string; nama: ShiftType; jam_mulai: string; jam_selesai: string } }) | null
  reguList: (Regu & { nomor_hp: string | null })[]
  petugasList: Petugas[]
  laporanList: Laporan[]
  template: string
}

interface Props {
  ulpDataList: UlpData[]
  today: string
}


export function DashboardClient({ ulpDataList, today }: Props) {
  const router = useRouter()
  const konfirmasi = useKonfirmasi()

  const [selectedUlpIdx, setSelectedUlpIdx] = useState(0)
  const selectedUlpIdxRef = useRef(0)
  const ulpDataListRef = useRef(ulpDataList)
  ulpDataListRef.current = ulpDataList
  const [newLaporanFlags, setNewLaporanFlags] = useState<Record<string, boolean>>({})

  const [laporanMap, setLaporanMap] = useState<Record<string, Laporan[]>>(
    () => Object.fromEntries(ulpDataList.map((d) => [d.ulp.id, d.laporanList]))
  )

  const [showTambahLaporan, setShowTambahLaporan] = useState(false)
  const [preselectedReguId, setPreselectedReguId] = useState<string | undefined>(undefined)
  const [updateModal, setUpdateModal] = useState<Laporan | null>(null)
  const [updateStatus, setUpdateStatus] = useState<StatusLaporan>('lapor')
  const [updateKeterangan, setUpdateKeterangan] = useState('')
  const [updating, setUpdating] = useState(false)
  const [pindahModal, setPindahModal] = useState<Laporan | null>(null)
  const [pindahUlpId, setPindahUlpId] = useState('')
  const [pindahReguId, setPindahReguId] = useState('')
  const [pindahing, setPindahing] = useState(false)
  const [sendingWa, setSendingWa] = useState<string | null>(null)
  const [sendingRekap, setSendingRekap] = useState<string | null>(null)

  // Auto-refresh saat jam shift berakhir agar piket aktif terupdate
  useEffect(() => {
    const pikets = ulpDataList.map((d) => d.piket).filter(Boolean)
    if (pikets.length === 0) return

    const now = new Date()
    const nowMs = now.getTime()

    const delays = pikets.map((piket) => {
      const [sh, sm] = piket!.shift_type.jam_selesai.split(':').map(Number)
      const target = new Date(now)
      target.setHours(sh, sm, 0, 0)
      if (target.getTime() <= nowMs) target.setDate(target.getDate() + 1)
      return target.getTime() - nowMs
    })

    const soonest = Math.min(...delays)
    const timer = setTimeout(() => router.refresh(), soonest)
    return () => clearTimeout(timer)
  }, [ulpDataList, router])

  const ulpIds = ulpDataList.map((d) => d.ulp.id)

  function handleSelectUlp(idx: number) {
    setSelectedUlpIdx(idx)
    selectedUlpIdxRef.current = idx
    const ulpId = ulpDataList[idx]?.ulp.id
    if (ulpId) setNewLaporanFlags((prev) => ({ ...prev, [ulpId]: false }))
  }

  const handleRealtimeInsert = useCallback((laporan: Laporan) => {
    setLaporanMap((prev) => {
      const existing = prev[laporan.ulp_id] ?? []
      if (existing.some((l) => l.id === laporan.id)) return prev
      return { ...prev, [laporan.ulp_id]: [laporan, ...existing] }
    })
    const currentUlpId = ulpDataListRef.current[selectedUlpIdxRef.current]?.ulp.id
    if (laporan.ulp_id !== currentUlpId) {
      setNewLaporanFlags((prev) => ({ ...prev, [laporan.ulp_id]: true }))
    }
  }, [])

  const handleRealtimeUpdate = useCallback((laporan: Laporan) => {
    setLaporanMap((prev) => {
      const existing = prev[laporan.ulp_id] ?? []
      return { ...prev, [laporan.ulp_id]: existing.map((l) => l.id === laporan.id ? laporan : l) }
    })
  }, [])

  useRealtimeLaporan({ ulpIds, onInsert: handleRealtimeInsert, onUpdate: handleRealtimeUpdate })

  function openUpdateLaporan(laporan: Laporan) {
    setUpdateModal(laporan)
    setUpdateStatus(laporan.status)
    setUpdateKeterangan(laporan.keterangan ?? '')
  }

  function closeUpdateModal() {
    setUpdateModal(null)
    setUpdateKeterangan('')
  }

  function openPindahModal(laporan: Laporan) {
    setPindahModal(laporan)
    setPindahUlpId(laporan.ulp_id)
    setPindahReguId(laporan.regu_id ?? '')
  }

  function closePindahModal() {
    setPindahModal(null)
    setPindahUlpId('')
    setPindahReguId('')
  }

  async function handleSubmitPindah() {
    if (!pindahModal || !pindahUlpId || !pindahReguId) return
    setPindahing(true)
    const res = await fetch(`/api/laporan/${pindahModal.id}/pindah`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulp_id: pindahUlpId, regu_id: pindahReguId }),
    })
    const json = await res.json()
    if (res.ok && json.data) {
      const oldUlpId = pindahModal.ulp_id
      setLaporanMap((prev) => {
        const next = { ...prev }
        // Hapus dari ULP lama
        next[oldUlpId] = (prev[oldUlpId] ?? []).filter((l) => l.id !== pindahModal.id)
        // Tambah ke ULP baru jika ada di list
        if (next[pindahUlpId]) {
          next[pindahUlpId] = [json.data, ...(prev[pindahUlpId] ?? []).filter((l) => l.id !== pindahModal.id)]
        }
        return next
      })
    }
    setPindahing(false)
    closePindahModal()
  }

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

  function handleTambahLaporan(reguId: string) {
    setPreselectedReguId(reguId)
    setShowTambahLaporan(true)
  }

  // Kiriman ke grup WA tidak bisa ditarik kembali, jadi selalu lewat konfirmasi.
  // Dialog yang menjalankan fetch-nya: tombol terkunci selama proses (mencegah
  // klik ganda mengirim dua kali) dan pesan galat dari server ditampilkan di
  // tempat — sebelumnya respons diabaikan sepenuhnya, jadi kegagalan kirim
  // sama sekali tidak terlihat oleh pengguna.
  async function kirim(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? 'Gagal mengirim pesan WhatsApp.')
    }
  }

  async function handleKirimWa(reguId: string) {
    const ulpData = ulpDataList.find((d) => d.reguList.some((r) => r.id === reguId))
    if (!ulpData) return
    const regu = ulpData.reguList.find((r) => r.id === reguId)
    const aktif = (laporanMap[ulpData.ulp.id] ?? [])
      .filter((l) => l.regu_id === reguId && l.status !== 'selesai').length

    await konfirmasi({
      judul: 'Kirim daftar laporan aktif ke grup WA?',
      pesan: 'Pesan langsung terkirim ke grup dan tidak bisa ditarik kembali.',
      rincian: [
        { label: 'Regu', nilai: regu?.nama ?? '—' },
        { label: 'ULP', nilai: ulpData.ulp.nama },
        { label: 'Laporan aktif', nilai: `${aktif} laporan` },
      ],
      labelAksi: 'Kirim sekarang',
      aksi: async () => {
        setSendingWa(reguId)
        try {
          await kirim('/api/wa/kirim-regu', {
            regu_id: reguId, ulp_id: ulpData.ulp.id, piket_id: ulpData.piket?.id ?? null,
          })
        } finally {
          setSendingWa(null)
        }
      },
    })
  }

  async function handleRekap(ulpId: string, piketId: string) {
    const ulpData = ulpDataList.find((d) => d.ulp.id === ulpId)

    await konfirmasi({
      judul: 'Kirim rekap serah terima ke grup WA?',
      pesan: 'Rekap berisi hitungan per regu dan daftar gangguan yang diserahterimakan ke shift berikutnya.',
      rincian: [
        { label: 'ULP', nilai: ulpData?.ulp.nama ?? '—' },
        { label: 'Shift', nilai: ulpData?.piket?.shift_type?.nama ?? '—' },
      ],
      labelAksi: 'Kirim rekap',
      aksi: async () => {
        setSendingRekap(ulpId)
        try {
          await kirim('/api/wa/rekap-piket', { ulp_id: ulpId, piket_id: piketId })
        } finally {
          setSendingRekap(null)
        }
      },
    })
  }

  const selectedData = ulpDataList[selectedUlpIdx] ?? ulpDataList[0]

  const { ulp, piket, reguList, petugasList } = selectedData
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
      penugasan_regu: regLaporan.filter((l) => l.status === 'penugasan_regu').length,
      ditangani: regLaporan.filter((l) => l.status === 'ditangani').length,
      nyala_sementara: regLaporan.filter((l) => l.status === 'nyala_sementara').length,
      selesai: regLaporan.filter((l) => l.status === 'selesai').length,
    }
  })

  const totalLapor = reguStats.reduce((s, r) => s + r.lapor, 0)
  const totalPenugasanRegu = reguStats.reduce((s, r) => s + r.penugasan_regu, 0)
  const totalDitangani = reguStats.reduce((s, r) => s + r.ditangani, 0)
  const totalNyalaSementara = reguStats.reduce((s, r) => s + r.nyala_sementara, 0)
  const totalSelesai = reguStats.reduce((s, r) => s + r.selesai, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 'calc(100vh - 3rem)', backgroundColor: 'var(--bg-base)' }}>
      {/* ULP Chip Selector — hanya tampil jika lebih dari 1 ULP */}
      {ulpDataList.length > 1 && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ULP:</span>
          {ulpDataList.map((d, idx) => (
            <button
              key={d.ulp.id}
              onClick={() => handleSelectUlp(idx)}
              style={{
                position: 'relative',
                padding: '4px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: idx === selectedUlpIdx ? 700 : 500,
                border: '2px solid',
                borderColor: idx === selectedUlpIdx ? 'var(--accent)' : 'var(--border)',
                backgroundColor: idx === selectedUlpIdx ? 'var(--accent)' : 'transparent',
                color: idx === selectedUlpIdx ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {d.ulp.nama}
              {newLaporanFlags[d.ulp.id] && idx !== selectedUlpIdx && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#E4002B',
                  border: '2px solid var(--bg-surface)',
                }} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Dashboard ULP yang dipilih — penuh */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header ULP */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b-2 border-neo-black shrink-0"
          style={{ backgroundColor: '#003B8E' }}
        >
          {/* Left: icon + ULP + shift info */}
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
            <LiveClock />
            <div className="flex items-center gap-1">
              <UlpStatChip label="L" value={totalLapor} bg="#E4002B" />
              <UlpStatChip label="R" value={totalPenugasanRegu} bg="#F5A623" />
              <UlpStatChip label="P" value={totalDitangani} bg="#0070C0" bordered />
              <UlpStatChip label="H" value={totalNyalaSementara} bg="#FFD200" textDark />
              <UlpStatChip label="S" value={totalSelesai} bg="#1DB954" />
            </div>
            <button
              onClick={() => setShowTambahLaporan(true)}
              className="px-2 py-0.5 text-xs font-bold border border-white/40 text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#E4002B' }}
            >
              ＋ Laporan
            </button>
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

        {/* Regu Grid */}
        {reguStats.length === 0 ? (
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Belum ada regu terdaftar</p>
            </div>
          </div>
        ) : (() => {
          const isTwoRows = reguStats.length > 4
          const topStats = isTwoRows ? reguStats.slice(0, Math.ceil(reguStats.length / 2)) : reguStats
          const bottomStats = isTwoRows ? reguStats.slice(Math.ceil(reguStats.length / 2)) : []

          function ReguRow({ items }: { items: typeof reguStats }) {
            return (
              <>
                {items.map((stats, i) => (
                  <div key={stats.regu.id} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <ReguCard
                      stats={stats}
                      onKirimWa={handleKirimWa}
                      onUpdateLaporan={openUpdateLaporan}
                      onPindahLaporan={openPindahModal}
                      onTambahLaporan={handleTambahLaporan}
                      sendingWa={sendingWa === stats.regu.id}
                    />
                  </div>
                ))}
              </>
            )
          }

          return (
            <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Baris atas */}
                <div style={{
                  flex: 1, minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${topStats.length}, 1fr)`,
                  borderBottom: isTwoRows ? '1px solid var(--border)' : 'none',
                }}>
                  <ReguRow items={topStats} />
                </div>
                {/* Baris bawah — hanya ada jika isTwoRows */}
                {isTwoRows && (
                  <div style={{
                    flex: 1, minHeight: 0,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${bottomStats.length}, 1fr)`,
                  }}>
                    <ReguRow items={bottomStats} />
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Tambah Laporan Modal */}
      <TambahLaporanModal
        open={showTambahLaporan}
        onClose={() => { setShowTambahLaporan(false); setPreselectedReguId(undefined) }}
        reguList={ulpDataList.flatMap((d) =>
          d.reguList.map((r): ReguForModal => ({ ...r, ulpNama: d.ulp.nama }))
        )}
        ulpId={ulp.id}
        ulpNama={ulp.nama}
        template={selectedData.template}
        defaultReguId={preselectedReguId}
      />

      {/* Update Status Modal */}
      <Modal
        open={!!updateModal}
        onClose={closeUpdateModal}
        title={`Update Status — #${updateModal?.nomor_tiket ?? ''}`}
      >
        {updateModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
            {/* Info Pelanggan */}
            <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{updateModal.nama_pelanggan}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{updateModal.lokasi}</p>
              {updateModal.keterangan && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{updateModal.keterangan}</p>
              )}
              <div style={{ marginTop: 4 }}>
                <StatusBadge status={updateModal.status} size="sm" />
              </div>
            </div>

            {/* Status Baru */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Status Baru</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(Object.entries(STATUS_LABEL) as [StatusLaporan, string][]).map(([val, label]) => {
                  const isChosen = updateStatus === val
                  return (
                    <button
                      key={val}
                      onClick={() => setUpdateStatus(val)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: isChosen ? 700 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: isChosen ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: isChosen ? 'var(--accent)' : 'var(--bg-surface-2)',
                        color: isChosen ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ width: 14, height: 14, borderRadius: 3, border: isChosen ? 'none' : '2px solid var(--border-strong)', backgroundColor: isChosen ? 'rgba(255,255,255,0.25)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                        {isChosen && '✓'}
                      </span>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Textarea
              label="Keterangan"
              placeholder="Keterangan update... (opsional)"
              rows={2}
              value={updateKeterangan}
              onChange={(e) => setUpdateKeterangan(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" style={{ flex: 1 }} onClick={closeUpdateModal}>Batal</Button>
              <Button variant="primary" style={{ flex: 1 }} loading={updating} onClick={handleSubmitUpdate}>Simpan</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pindah Laporan Modal */}
      <Modal
        open={!!pindahModal}
        onClose={closePindahModal}
        title={`Pindah Laporan — #${pindahModal?.nomor_tiket ?? ''}`}
      >
        {pindahModal && (() => {
          const reguUlpTarget = ulpDataList.find((d) => d.ulp.id === pindahUlpId)?.reguList ?? []
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{pindahModal.nama_pelanggan}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{pindahModal.lokasi}</p>
                <div style={{ marginTop: 4 }}>
                  <StatusBadge status={pindahModal.status} size="sm" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>ULP Tujuan</label>
                <select
                  value={pindahUlpId}
                  onChange={(e) => { setPindahUlpId(e.target.value); setPindahReguId('') }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
                >
                  {ulpDataList.map((d) => (
                    <option key={d.ulp.id} value={d.ulp.id}>{d.ulp.nama}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Regu Tujuan</label>
                <select
                  value={pindahReguId}
                  onChange={(e) => setPindahReguId(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
                >
                  <option value="">— Pilih Regu —</option>
                  {reguUlpTarget.map((r) => (
                    <option key={r.id} value={r.id}>{r.nama}</option>
                  ))}
                </select>
              </div>

              {pindahUlpId !== pindahModal.ulp_id && (
                <p style={{ fontSize: 11, color: '#F59E0B', margin: 0, padding: '8px 12px', backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
                  ⚠ Pindah ke ULP berbeda — piket dan riwayat WA akan di-reset
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" style={{ flex: 1 }} onClick={closePindahModal}>Batal</Button>
                <Button
                  variant="primary"
                  style={{ flex: 1 }}
                  loading={pindahing}
                  onClick={handleSubmitPindah}
                  disabled={!pindahReguId || (pindahUlpId === pindahModal.ulp_id && pindahReguId === (pindahModal.regu_id ?? ''))}
                >
                  Pindahkan
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-right hidden md:block">
      <div className="text-white font-mono text-sm font-black leading-none" suppressHydrationWarning>
        {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-blue-200 text-xs leading-none mt-0.5">
        {now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
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
