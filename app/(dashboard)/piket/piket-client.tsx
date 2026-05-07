'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { SHIFT_LABEL, SHIFT_JAM } from '@/constants'
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

export function PiketClient({ ulpId, role, piketList: initial, shiftTypes, reguList, petugasMaster }: Props) {
  const [piketList, setPiketList] = useState<PiketRow[]>(initial)
  const [selectedShift, setSelectedShift] = useState(shiftTypes[0]?.id ?? '')
  const [selectedTanggal, setSelectedTanggal] = useState(new Date().toISOString().split('T')[0])
  const [namaCC, setNamaCC] = useState('')
  // Map: regu_id -> [slot1_petugas_id, slot2_petugas_id]
  const [petugasAssign, setPetugasAssign] = useState<Record<string, [string, string]>>(() =>
    Object.fromEntries(reguList.map((r) => [r.id, ['', '']]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = role === 'admin' || role === 'supervisor' || role === 'cc'
  const today = new Date().toISOString().split('T')[0]
  const todayPiket = piketList.filter((p) => p.tanggal === today)

  function setSlot(reguId: string, slot: 0 | 1, petugasId: string) {
    setPetugasAssign((prev) => {
      const current = prev[reguId] ?? ['', '']
      const updated: [string, string] = [...current] as [string, string]
      updated[slot] = petugasId
      return { ...prev, [reguId]: updated }
    })
  }

  // Semua petugas yang sudah dipilih di slot manapun, kecuali slot saat ini
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

  async function handleBuat() {
    if (!selectedShift) return
    if (!namaCC.trim()) {
      setError('Nama CC wajib diisi')
      return
    }
    setLoading(true)
    setError(null)

    const petugas_assignments = reguList.flatMap((regu) => {
      const slots = petugasAssign[regu.id] ?? ['', '']
      const petugas_ids = slots.filter(Boolean)
      if (!petugas_ids.length) return []
      return [{ regu_id: regu.id, petugas_ids }]
    })

    const res = await fetch('/api/piket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ulp_id: ulpId,
        shift_type_id: selectedShift,
        tanggal: selectedTanggal,
        nama_cc: namaCC.trim() || null,
        petugas_assignments,
      }),
    })
    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error ?? 'Gagal membuat piket')
    } else {
      // Tambah piket_petugas kosong ke data — akan diisi saat reload / fetch ulang
      // Untuk display langsung: rekonstruksi piket_petugas dari state
      const piketPetugasForDisplay: PiketPetugasNested[] = petugas_assignments.flatMap(({ regu_id, petugas_ids }) =>
        petugas_ids.map((pid) => ({
          regu_id,
          petugas: { id: pid, nama: petugasMaster.find((p) => p.id === pid)?.nama ?? '' },
        }))
      )
      setPiketList((prev) => [{ ...json.data, piket_petugas: piketPetugasForDisplay }, ...prev])
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
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-neo-black mb-4 uppercase tracking-wide">
        Manajemen Piket
      </h1>

      {canManage && (
        <Card className="mb-6">
          <div className="p-4 border-b-2 border-neo-black bg-pln-yellow">
            <h2 className="font-black text-neo-black">+ Buat Piket Baru</h2>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {/* Shift + Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Shift"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                {shiftTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {SHIFT_LABEL[s.nama]} ({SHIFT_JAM[s.nama].mulai}–{SHIFT_JAM[s.nama].selesai})
                  </option>
                ))}
              </Select>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-bold text-neo-black">Tanggal</label>
                <input
                  type="date"
                  value={selectedTanggal}
                  onChange={(e) => setSelectedTanggal(e.target.value)}
                  className="neo-input px-3 py-2 text-sm font-medium"
                />
              </div>
            </div>

            {/* Nama CC */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-neo-black">
                Nama CC Piket <span className="text-pln-red">*</span>
              </label>
              <input
                type="text"
                placeholder="Nama petugas Command Center..."
                value={namaCC}
                onChange={(e) => setNamaCC(e.target.value)}
                className="neo-input px-3 py-2 text-sm font-medium"
              />
            </div>

            {/* Petugas per Regu */}
            {reguList.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-neo-black border-b border-neo-gray pb-1">
                  Petugas per Regu
                </label>
                {reguList.map((regu) => {
                  const slots = petugasAssign[regu.id] ?? ['', '']
                  return (
                    <div key={regu.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neo-black w-16 shrink-0">{regu.nama}</span>
                      {([0, 1] as const).map((slot) => {
                        const excluded = getSelectedElsewhere(regu.id, slot)
                        return (
                          <select
                            key={slot}
                            value={slots[slot]}
                            onChange={(e) => setSlot(regu.id, slot, e.target.value)}
                            className="neo-input px-2 py-1.5 text-xs flex-1 font-medium"
                          >
                            <option value="">— Pilih petugas —</option>
                            {petugasMaster
                              .filter((p) => !excluded.has(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>{p.nama}</option>
                              ))}
                          </select>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {error && <p className="text-sm font-medium text-pln-red">{error}</p>}

            <Button variant="primary" loading={loading} onClick={handleBuat}>
              Buat Piket
            </Button>
          </div>
        </Card>
      )}

      {/* Piket hari ini */}
      <div className="mb-6">
        <h2 className="font-black text-neo-black mb-2 text-sm uppercase tracking-wide border-b-2 border-neo-black pb-1">
          Piket Hari Ini — {formatTanggal(today)}
        </h2>
        {todayPiket.length === 0 ? (
          <div className="neo-border p-4 text-center text-sm text-gray-500 font-medium bg-neo-gray">
            Belum ada piket hari ini
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayPiket.map((piket) => (
              <PiketRowItem key={piket.id} piket={piket} reguList={reguList} onHapus={handleHapus} canManage={canManage} isToday />
            ))}
          </div>
        )}
      </div>

      {/* Riwayat piket */}
      <div>
        <h2 className="font-black text-neo-black mb-2 text-sm uppercase tracking-wide border-b-2 border-neo-black pb-1">
          Riwayat Piket
        </h2>
        <div className="flex flex-col gap-2">
          {piketList
            .filter((p) => p.tanggal !== today)
            .map((piket) => (
              <PiketRowItem key={piket.id} piket={piket} reguList={reguList} onHapus={handleHapus} canManage={canManage} isToday={false} />
            ))}
        </div>
      </div>
    </div>
  )
}

function PiketRowItem({
  piket,
  reguList,
  onHapus,
  canManage,
  isToday,
}: {
  piket: PiketRow
  reguList: ReguMini[]
  onHapus: (id: string) => void
  canManage: boolean
  isToday: boolean
}) {
  const shift = piket.shift_type

  // Group piket_petugas by regu_id
  const petugasByRegu: Record<string, string[]> = {}
  for (const pp of piket.piket_petugas ?? []) {
    if (!petugasByRegu[pp.regu_id]) petugasByRegu[pp.regu_id] = []
    petugasByRegu[pp.regu_id].push(pp.petugas.nama)
  }

  const reguWithPetugas = reguList.filter((r) => petugasByRegu[r.id]?.length)

  return (
    <div className={`neo-border p-3 ${isToday ? 'bg-pln-yellow/20' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-black text-neo-black text-sm">
            {SHIFT_LABEL[shift.nama]} — {formatTanggal(piket.tanggal)}
          </div>
          <div className="text-xs text-gray-500 font-medium flex items-center gap-2 flex-wrap mt-0.5">
            <span>{SHIFT_JAM[shift.nama].mulai} – {SHIFT_JAM[shift.nama].selesai}</span>
            {piket.nama_cc && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-pln-blue font-bold">👤 CC: {piket.nama_cc}</span>
              </>
            )}
            {isToday && (
              <span className="px-1.5 py-0.5 bg-pln-green text-white text-xs font-bold">AKTIF</span>
            )}
          </div>

          {/* Petugas per regu */}
          {reguWithPetugas.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5">
              {reguWithPetugas.map((regu) => (
                <div key={regu.id} className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-neo-black w-14 shrink-0">{regu.nama}:</span>
                  <span className="text-gray-600">{petugasByRegu[regu.id].join(' & ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {canManage && (
          <Button variant="danger" size="sm" onClick={() => onHapus(piket.id)} className="shrink-0">
            Hapus
          </Button>
        )}
      </div>
    </div>
  )
}
