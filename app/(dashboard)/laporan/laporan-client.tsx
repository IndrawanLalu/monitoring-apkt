'use client'

import { useState, useMemo } from 'react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select, Textarea } from '@/components/ui/input'
import { LaporanForm } from '@/components/laporan/laporan-form'
import { STATUS_LAPORAN, STATUS_LABEL, STATUS_EMOJI } from '@/constants'
import { formatTanggalWaktu, formatRelative } from '@/lib/utils/format'
import { createClient } from '@/lib/supabase/client'
import type { Laporan, Regu, RiwayatStatus, StatusLaporan } from '@/types'
import type { CreateLaporanInput } from '@/lib/validations/laporan'

const UPDATED_BY_LABEL: Record<string, string> = {
  cc: 'Command Center',
  petugas: 'Petugas',
  system: 'Sistem',
}

interface Props {
  ulpId: string
  role: string
  laporanList: Laporan[]
  reguList: Regu[]
}

export function LaporanClient({ ulpId, role, laporanList: initial, reguList }: Props) {
  const [laporanList, setLaporanList] = useState<Laporan[]>(initial)
  const [filterStatus, setFilterStatus] = useState<StatusLaporan | 'semua'>('semua')
  const [filterRegu, setFilterRegu] = useState<string>('semua')
  const [search, setSearch] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [updateModal, setUpdateModal] = useState<Laporan | null>(null)
  const [updateStatus, setUpdateStatus] = useState<StatusLaporan>('lapor')
  const [updateKeterangan, setUpdateKeterangan] = useState('')
  const [updating, setUpdating] = useState(false)
  const [riwayatModal, setRiwayatModal] = useState<Laporan | null>(null)
  const [riwayatList, setRiwayatList] = useState<RiwayatStatus[]>([])
  const [riwayatLoading, setRiwayatLoading] = useState(false)

  const canManage = role === 'admin' || role === 'supervisor' || role === 'cc'

  const filtered = useMemo(() => {
    return laporanList.filter((l) => {
      if (filterStatus !== 'semua' && l.status !== filterStatus) return false
      if (filterRegu !== 'semua' && l.regu_id !== filterRegu) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          l.nomor_tiket.toLowerCase().includes(q) ||
          l.nama_pelanggan.toLowerCase().includes(q) ||
          l.lokasi.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [laporanList, filterStatus, filterRegu, search])

  const reguMap = useMemo(() => {
    const m: Record<string, string> = {}
    reguList.forEach((r) => (m[r.id] = r.nama))
    return m
  }, [reguList])

  async function handleAddLaporan(data: CreateLaporanInput): Promise<{ error?: string }> {
    const res = await fetch('/api/laporan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ulp_id: ulpId }),
    })
    const json = await res.json()
    if (!res.ok || json.error) return { error: json.error }
    setLaporanList((prev) => [json.data, ...prev])
    setAddModalOpen(false)
    return {}
  }

  function openUpdate(laporan: Laporan) {
    setUpdateModal(laporan)
    setUpdateStatus(laporan.status)
    setUpdateKeterangan(laporan.keterangan ?? '')
  }

  async function handleOpenRiwayat(laporan: Laporan) {
    setRiwayatModal(laporan)
    setRiwayatList([])
    setRiwayatLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('riwayat_status')
      .select('id, laporan_id, status_lama, status_baru, keterangan, updated_by, created_at')
      .eq('laporan_id', laporan.id)
      .order('created_at', { ascending: true })
    setRiwayatList((data ?? []) as RiwayatStatus[])
    setRiwayatLoading(false)
  }

  async function handleUpdate() {
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
    setUpdateModal(null)
  }

  const counts = {
    lapor: laporanList.filter((l) => l.status === 'lapor').length,
    ditangani: laporanList.filter((l) => l.status === 'ditangani').length,
    nyala_sementara: laporanList.filter((l) => l.status === 'nyala_sementara').length,
    selesai: laporanList.filter((l) => l.status === 'selesai').length,
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b-2 border-neo-black bg-neo-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black text-neo-black uppercase tracking-wide">Daftar Laporan</h1>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setAddModalOpen(true)}>
              + Laporan Baru
            </Button>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {([
            { status: 'lapor', label: 'Lapor', color: '#E4002B' },
            { status: 'ditangani', label: 'Proses', color: '#0070C0' },
            { status: 'nyala_sementara', label: 'Hold', color: '#FFD200' },
            { status: 'selesai', label: 'Selesai', color: '#1DB954' },
          ] as const).map(({ status, label, color }) => (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'semua' : status)}
              className="neo-button px-3 py-1 text-xs font-bold"
              style={{
                backgroundColor: filterStatus === status ? color : '#fff',
                color: filterStatus === status ? (status === 'nyala_sementara' ? '#1A1A1A' : '#fff') : color,
                borderColor: color,
              }}
            >
              {counts[status]} {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Cari tiket, nama, lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="neo-input px-3 py-1.5 text-sm flex-1 min-w-48"
          />
          <select
            value={filterRegu}
            onChange={(e) => setFilterRegu(e.target.value)}
            className="neo-input px-3 py-1.5 text-sm"
          >
            <option value="semua">Semua Regu</option>
            {reguList.map((r) => (
              <option key={r.id} value={r.id}>{r.nama}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-neo-black text-white">
            <tr>
              <th className="text-left px-3 py-2 font-bold">No. Tiket</th>
              <th className="text-left px-3 py-2 font-bold">Pelanggan</th>
              <th className="text-left px-3 py-2 font-bold hidden md:table-cell">Lokasi</th>
              <th className="text-left px-3 py-2 font-bold hidden lg:table-cell">Regu</th>
              <th className="text-left px-3 py-2 font-bold">Status</th>
              <th className="text-left px-3 py-2 font-bold hidden xl:table-cell">Keterangan</th>
              <th className="text-left px-3 py-2 font-bold hidden lg:table-cell">Waktu</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neo-gray">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400 font-medium">
                  Tidak ada laporan
                </td>
              </tr>
            ) : (
              filtered.map((laporan) => (
                <tr key={laporan.id} className="hover:bg-neo-gray/40 transition-colors">
                  <td className="px-3 py-2 font-bold font-mono text-xs">#{laporan.nomor_tiket}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{laporan.nama_pelanggan}</div>
                    {laporan.nomor_pelanggan && (
                      <div className="text-xs text-gray-500">{laporan.nomor_pelanggan}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 hidden md:table-cell max-w-40 truncate">
                    {laporan.lokasi}
                  </td>
                  <td className="px-3 py-2 text-gray-600 hidden lg:table-cell">
                    {reguMap[laporan.regu_id] ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={laporan.status} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs italic hidden xl:table-cell max-w-48 truncate">
                    {laporan.keterangan ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">
                    <div>{formatRelative(laporan.created_at)}</div>
                    <div className="font-mono">{formatTanggalWaktu(laporan.created_at)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => handleOpenRiwayat(laporan)}>
                        Riwayat
                      </Button>
                      {canManage && laporan.status !== 'selesai' && (
                        <Button variant="primary" size="sm" onClick={() => openUpdate(laporan)}>
                          Update
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="shrink-0 px-4 py-2 border-t-2 border-neo-black bg-neo-gray text-xs font-medium text-gray-500">
        Menampilkan {filtered.length} dari {laporanList.length} laporan
      </div>

      {/* Modal tambah laporan */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Input Laporan Baru">
        <LaporanForm
          reguList={reguList}
          onSubmit={handleAddLaporan}
          onCancel={() => setAddModalOpen(false)}
        />
      </Modal>

      {/* Modal riwayat status */}
      <Modal
        open={!!riwayatModal}
        onClose={() => setRiwayatModal(null)}
        title={`Riwayat Status — #${riwayatModal?.nomor_tiket ?? ''}`}
      >
        {riwayatModal && (
          <div className="flex flex-col gap-3 min-w-80">
            <div className="neo-border p-3 bg-neo-gray text-sm">
              <p className="font-bold">{riwayatModal.nama_pelanggan}</p>
              <p className="text-gray-600 text-xs">{riwayatModal.lokasi}</p>
              <div className="mt-1"><StatusBadge status={riwayatModal.status} size="sm" /></div>
            </div>

            {riwayatLoading && (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-pln-blue border-t-transparent rounded-full animate-spin" />
                Memuat riwayat...
              </div>
            )}

            {!riwayatLoading && riwayatList.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">Belum ada riwayat perubahan status</div>
            )}

            {!riwayatLoading && riwayatList.length > 0 && (
              <div className="flex flex-col">
                {riwayatList.map((r, idx) => (
                  <div key={r.id} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-neo-black bg-pln-yellow shrink-0 mt-1" />
                      {idx < riwayatList.length - 1 && (
                        <div className="w-0.5 flex-1 bg-neo-gray my-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold">
                          {STATUS_EMOJI[r.status_lama]} {STATUS_LABEL[r.status_lama]}
                        </span>
                        <span className="text-xs text-gray-400">→</span>
                        <span className="text-xs font-bold">
                          {STATUS_EMOJI[r.status_baru]} {STATUS_LABEL[r.status_baru]}
                        </span>
                      </div>
                      {r.keterangan && (
                        <p className="text-xs text-gray-600 italic mt-0.5">{r.keterangan}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTanggalWaktu(r.created_at)} · {UPDATED_BY_LABEL[r.updated_by] ?? r.updated_by}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal update status */}
      <Modal
        open={!!updateModal}
        onClose={() => setUpdateModal(null)}
        title={`Update Status — #${updateModal?.nomor_tiket ?? ''}`}
      >
        {updateModal && (
          <div className="flex flex-col gap-4">
            <div className="neo-border p-3 bg-neo-gray text-sm">
              <p><span className="font-bold">Pelanggan:</span> {updateModal.nama_pelanggan}</p>
              <p><span className="font-bold">Lokasi:</span> {updateModal.lokasi}</p>
              <p><span className="font-bold">Status saat ini:</span> <StatusBadge status={updateModal.status} size="sm" className="ml-1" /></p>
            </div>

            <Select
              label="Status Baru"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as StatusLaporan)}
            >
              {Object.entries(STATUS_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>

            <Textarea
              label="Keterangan"
              placeholder="Keterangan update..."
              rows={3}
              value={updateKeterangan}
              onChange={(e) => setUpdateKeterangan(e.target.value)}
            />

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setUpdateModal(null)}>
                Batal
              </Button>
              <Button variant="primary" className="flex-1" loading={updating} onClick={handleUpdate}>
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
