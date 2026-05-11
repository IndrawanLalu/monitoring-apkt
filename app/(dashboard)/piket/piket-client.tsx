'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { SHIFT_LABEL } from '@/constants'
import { formatTanggal } from '@/lib/utils/format'
import type { ShiftType } from '@/types'

interface ShiftTypeRow {
  id: string
  nama: ShiftType
  jam_mulai: string
  jam_selesai: string
}

interface PetugasMini {
  id: string
  nama: string
  nomor_hp: string | null
}

interface ReguMini {
  id: string
  nama: string
}

interface PiketPetugasNested {
  regu_id: string
  petugas: { id: string; nama: string }
}

interface PiketRow {
  id: string
  tanggal: string
  ulp_id: string
  shift_type_id: string
  nama_cc: string | null
  created_at: string
  shift_type: ShiftTypeRow
  piket_petugas: PiketPetugasNested[]
}

interface Props {
  ulpId: string
  role: string
  piketList: PiketRow[]
  shiftTypes: ShiftTypeRow[]
  reguList: ReguMini[]
  petugasMaster: PetugasMini[]
}

const fmtJam = (j: string) => j.slice(0, 5)

function isShiftActive(jamMulai: string, jamSelesai: string): boolean {
  const now = new Date()
  const nowM = now.getHours() * 60 + now.getMinutes()
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export function PiketClient({ ulpId, role, piketList: initial, shiftTypes, reguList, petugasMaster }: Props) {
  const [piketList, setPiketList] = useState<PiketRow[]>(initial)
  const [namaCC, setNamaCC] = useState('')
  const [petugasAssign, setPetugasAssign] = useState<Record<string, [string, string]>>(() =>
    Object.fromEntries(reguList.map((r) => [r.id, ['', '']]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const canManage = role === 'admin' || role === 'supervisor' || role === 'cc'
  // Tanggal WITA (UTC+8) — toISOString() selalu UTC, perlu offset manual
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  const activePiket = piketList.find(
    (p) => p.tanggal === today && isShiftActive(p.shift_type.jam_mulai, p.shift_type.jam_selesai),
  )
  const currentShiftType = shiftTypes.find((s) => isShiftActive(s.jam_mulai, s.jam_selesai))

  function setSlot(reguId: string, slot: 0 | 1, petugasId: string) {
    setPetugasAssign((prev) => {
      const cur = prev[reguId] ?? ['', '']
      const updated: [string, string] = [cur[0], cur[1]]
      updated[slot] = petugasId
      return { ...prev, [reguId]: updated }
    })
  }

  function getSelectedElsewhere(reguId: string, slot: 0 | 1): Set<string> {
    const used = new Set<string>()
    for (const [rid, slots] of Object.entries(petugasAssign)) {
      for (let s = 0; s < 2; s++) {
        if (rid === reguId && s === slot) continue
        if (slots[s]) used.add(slots[s])
      }
    }
    return used
  }

  function handlePakai(piket: PiketRow) {
    setNamaCC(piket.nama_cc ?? '')
    const newAssign: Record<string, [string, string]> = Object.fromEntries(
      reguList.map((r) => [r.id, ['', '']]),
    )
    for (const pp of piket.piket_petugas ?? []) {
      const slots = newAssign[pp.regu_id] ?? ['', '']
      if (!slots[0]) slots[0] = pp.petugas.id
      else slots[1] = pp.petugas.id
      newAssign[pp.regu_id] = slots
    }
    setPetugasAssign(newAssign)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleBuat() {
    if (!currentShiftType) { setError('Tidak dapat menentukan shift saat ini'); return }
    if (!namaCC.trim()) { setError('Nama CC wajib diisi'); return }

    const petugas_assignments = reguList.flatMap((regu) => {
      const slots = petugasAssign[regu.id] ?? ['', '']
      const ids = slots.filter(Boolean)
      return ids.length ? [{ regu_id: regu.id, petugas_ids: ids }] : []
    })

    const reguKosong = reguList.filter((r) => !(petugasAssign[r.id] ?? []).some(Boolean))
    if (reguKosong.length > 0) {
      setError(`Regu belum ada petugas: ${reguKosong.map((r) => r.nama).join(', ')}`)
      return
    }

    setLoading(true)
    setError(null)

    const res = await fetch('/api/piket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ulp_id: ulpId,
        shift_type_id: currentShiftType.id,
        tanggal: today,
        nama_cc: namaCC.trim(),
        petugas_assignments,
      }),
    })
    const json = await res.json() as { data: PiketRow; error: string | null }

    if (!res.ok || json.error) {
      setError(json.error ?? 'Gagal membuat piket')
    } else {
      const display: PiketPetugasNested[] = petugas_assignments.flatMap(({ regu_id, petugas_ids }) =>
        petugas_ids.map((pid) => ({
          regu_id,
          petugas: { id: pid, nama: petugasMaster.find((p) => p.id === pid)?.nama ?? '' },
        })),
      )
      setPiketList((prev) => [{ ...json.data, piket_petugas: display }, ...prev])
      setNamaCC('')
      setPetugasAssign(Object.fromEntries(reguList.map((r) => [r.id, ['', '']])))
    }
    setLoading(false)
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus piket ini?')) return
    await fetch(`/api/piket/${id}`, { method: 'DELETE' })
    setPiketList((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Form / Active notice */}
      {canManage && (
        <div ref={formRef} className="shrink-0 border-b-2 border-neo-black">
          {activePiket ? (
            <div className="px-6 py-3 flex items-center gap-3 bg-[#1DB954]/10">
              <span className="text-xl">✅</span>
              <div>
                <span className="font-black text-neo-black text-sm">
                  {SHIFT_LABEL[activePiket.shift_type.nama]} sedang aktif
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {fmtJam(activePiket.shift_type.jam_mulai)}–{fmtJam(activePiket.shift_type.jam_selesai)}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Piket baru bisa dibuat setelah shift berakhir pukul{' '}
                  <strong>{fmtJam(activePiket.shift_type.jam_selesai)}</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 max-w-5xl mx-auto">
              <div className="border-2 border-neo-black shadow-neo">
                <div className="px-4 py-3 border-b-2 border-neo-black bg-pln-yellow flex items-center gap-3">
                  <span className="font-black text-neo-black">+ Buat Piket Baru</span>
                  {currentShiftType && (
                    <span className="text-xs font-bold text-neo-black/70">
                      {SHIFT_LABEL[currentShiftType.nama]} · {fmtJam(currentShiftType.jam_mulai)}–{fmtJam(currentShiftType.jam_selesai)} · {formatTanggal(today + 'T00:00:00')}
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {/* Nama CC */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-neo-black w-24 shrink-0">
                      Nama CC <span className="text-pln-red">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Nama petugas Command Center..."
                      value={namaCC}
                      onChange={(e) => setNamaCC(e.target.value)}
                      className="neo-input px-3 py-2 text-sm font-medium flex-1"
                    />
                  </div>

                  {/* Petugas grid */}
                  {reguList.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-neo-black mb-2 uppercase tracking-wide">Petugas per Regu</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {reguList.map((regu) => {
                          const slots = petugasAssign[regu.id] ?? ['', '']
                          return (
                            <div key={regu.id} className="flex items-center gap-2 border border-neo-gray px-2 py-1.5">
                              <span className="text-xs font-black text-neo-black w-14 shrink-0">{regu.nama}</span>
                              {([0, 1] as const).map((slot) => (
                                <select
                                  key={slot}
                                  value={slots[slot]}
                                  onChange={(e) => setSlot(regu.id, slot, e.target.value)}
                                  className="neo-input px-2 py-1 text-xs flex-1"
                                >
                                  <option value="">— Pilih —</option>
                                  {petugasMaster
                                    .filter((p) => !getSelectedElsewhere(regu.id, slot).has(p.id))
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>{p.nama}</option>
                                    ))}
                                </select>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {error && <p className="text-sm font-medium text-pln-red">{error}</p>}

                  <div className="flex justify-end">
                    <Button variant="primary" loading={loading} onClick={handleBuat}>
                      Buat Piket
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Riwayat */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-3">
          <h2 className="font-black text-neo-black text-sm uppercase tracking-wide border-b-2 border-neo-black pb-2">
            Riwayat Piket
          </h2>
          {piketList.length === 0 ? (
            <div className="border-2 border-neo-black p-8 text-center text-sm text-gray-400 bg-neo-gray">
              Belum ada data piket
            </div>
          ) : (
            piketList.map((piket) => (
              <PiketCard
                key={piket.id}
                piket={piket}
                reguList={reguList}
                canManage={canManage}
                isActive={piket.id === activePiket?.id}
                onHapus={handleHapus}
                onPakai={handlePakai}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function PiketCard({
  piket,
  reguList,
  canManage,
  isActive,
  onHapus,
  onPakai,
}: {
  piket: PiketRow
  reguList: ReguMini[]
  canManage: boolean
  isActive: boolean
  onHapus: (id: string) => void
  onPakai: (piket: PiketRow) => void
}) {
  const shift = piket.shift_type
  const petugasByRegu: Record<string, string[]> = {}
  for (const pp of piket.piket_petugas ?? []) {
    if (!petugasByRegu[pp.regu_id]) petugasByRegu[pp.regu_id] = []
    petugasByRegu[pp.regu_id].push(pp.petugas.nama)
  }
  const reguWithPetugas = reguList.filter((r) => petugasByRegu[r.id]?.length)

  return (
    <div className={`border-2 border-neo-black shadow-neo overflow-hidden ${isActive ? 'ring-2 ring-[#1DB954]' : ''}`}>
      {/* Header card */}
      <div
        className="px-4 py-3 border-b-2 border-neo-black flex items-center justify-between gap-3 flex-wrap"
        style={{ backgroundColor: isActive ? '#1DB954' : '#E5E5E5' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`font-black text-sm ${isActive ? 'text-white' : 'text-neo-black'}`}>
            {SHIFT_LABEL[shift.nama]} — {formatTanggal(piket.tanggal + 'T00:00:00')}
          </span>
          <span className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
            {fmtJam(shift.jam_mulai)}–{fmtJam(shift.jam_selesai)}
          </span>
          {piket.nama_cc && (
            <span className={`text-xs font-bold ${isActive ? 'text-white/90' : 'text-pln-blue'}`}>
              👤 {piket.nama_cc}
            </span>
          )}
          {isActive && (
            <span className="px-2 py-0.5 bg-white text-[#1DB954] text-xs font-black border-2 border-white">
              AKTIF
            </span>
          )}
        </div>

        {canManage && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => onPakai(piket)}
              className="px-3 py-1.5 text-xs font-bold border-2 border-neo-black bg-pln-yellow text-neo-black hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
            >
              ♻️ Pakai Piket Ini
            </button>
            <button
              onClick={() => onHapus(piket.id)}
              className="px-3 py-1.5 text-xs font-bold border-2 border-pln-red bg-white text-pln-red hover:bg-pln-red hover:text-white transition-colors"
            >
              Hapus
            </button>
          </div>
        )}
      </div>

      {/* Petugas grid */}
      {reguWithPetugas.length > 0 ? (
        <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-neo-white">
          {reguWithPetugas.map((regu) => (
            <div key={regu.id}>
              <p className="text-xs font-black text-neo-black">{regu.nama}</p>
              <p className="text-xs text-gray-600 mt-0.5">{petugasByRegu[regu.id].join(' & ')}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-xs text-gray-400 italic bg-neo-white">
          Tidak ada data petugas
        </div>
      )}
    </div>
  )
}
