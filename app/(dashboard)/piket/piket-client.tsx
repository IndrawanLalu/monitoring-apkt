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
  ulp_id: string
}

interface ReguMini {
  id: string
  nama: string
  ulp_id: string
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

interface UlpInfo {
  id: string
  nama: string
  kode: string
  wa_grup_id: string | null
}

interface Props {
  ulps: UlpInfo[]
  role: string
  piketList: PiketRow[]
  shiftTypes: ShiftTypeRow[]
  reguList: ReguMini[]
  petugasMaster: PetugasMini[]
}

const fmtJam = (j: string) => j.slice(0, 5)

function isShiftActive(jamMulai: string, jamSelesai: string): boolean {
  const nowUtc = new Date()
  const nowWita = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000)
  const nowM = nowWita.getUTCHours() * 60 + nowWita.getUTCMinutes()
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export function PiketClient({ ulps, role, piketList: initial, shiftTypes, reguList, petugasMaster }: Props) {
  const [piketList, setPiketList] = useState<PiketRow[]>(initial)
  const [namaCC, setNamaCC] = useState('')
  const [selectedUlps, setSelectedUlps] = useState<string[]>(ulps.map(u => u.id))
  
  const [petugasAssign, setPetugasAssign] = useState<Record<string, [string, string]>>(() =>
    Object.fromEntries(reguList.map((r) => [r.id, ['', '']]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const canManage = role === 'admin' || role === 'supervisor' || role === 'cc'
  
  // Tanggal WITA (UTC+8)
  const todayDate = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const today = todayDate.toISOString().split('T')[0]

  const activePikets = piketList.filter(
    (p) => p.tanggal === today && isShiftActive(p.shift_type.jam_mulai, p.shift_type.jam_selesai),
  )
  const activeUlpIds = new Set(activePikets.map(p => p.ulp_id))
  const currentShiftType = shiftTypes.find((s) => isShiftActive(s.jam_mulai, s.jam_selesai))

  function toggleUlp(id: string) {
    setSelectedUlps(prev => 
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    )
  }

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
    if (!selectedUlps.includes(piket.ulp_id)) {
      setSelectedUlps(prev => [...prev, piket.ulp_id])
    }
    const newAssign = { ...petugasAssign }
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
    if (selectedUlps.length === 0) { setError('Pilih minimal 1 ULP'); return }

    const reguKosong = reguList
      .filter(r => selectedUlps.includes(r.ulp_id))
      .filter((r) => !(petugasAssign[r.id] ?? []).some(Boolean))
      
    if (reguKosong.length > 0) {
      setError(`Regu belum ada petugas: ${reguKosong.map((r) => r.nama).join(', ')}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newPikets: PiketRow[] = []
      
      for (const uId of selectedUlps) {
        const petugas_assignments = reguList
          .filter(r => r.ulp_id === uId)
          .flatMap((regu) => {
            const slots = petugasAssign[regu.id] ?? ['', '']
            const ids = slots.filter(Boolean)
            return ids.length ? [{ regu_id: regu.id, petugas_ids: ids }] : []
          })

        const res = await fetch('/api/piket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ulp_id: uId,
            shift_type_id: currentShiftType.id,
            tanggal: today,
            nama_cc: namaCC.trim(),
            petugas_assignments,
          }),
        })
        
        const json = await res.json() as { data: PiketRow; error: string | null }
        if (!res.ok || json.error) {
           // Skip if conflict (already exists), but we should probably inform user
           if (res.status !== 409) {
             throw new Error(json.error ?? 'Gagal membuat piket')
           }
        } else {
           const display: PiketPetugasNested[] = petugas_assignments.flatMap(({ regu_id, petugas_ids }) =>
             petugas_ids.map((pid) => ({
               regu_id,
               petugas: { id: pid, nama: petugasMaster.find((p) => p.id === pid)?.nama ?? '' },
             })),
           )
           newPikets.push({ ...json.data, piket_petugas: display })
        }
      }

      if (newPikets.length > 0) {
        setPiketList((prev) => [...newPikets, ...prev])
        setNamaCC('')
        setPetugasAssign(Object.fromEntries(reguList.map((r) => [r.id, ['', '']])))
        // Do not clear selectedUlps, user might want same combo next time
      } else {
        // This implies all selected ULPs returned 409 (already have shifts)
        setError('Piket untuk ULP tersebut sudah dibuat.')
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus piket ini?')) return
    await fetch(`/api/piket/${id}`, { method: 'DELETE' })
    setPiketList((prev) => prev.filter((p) => p.id !== id))
  }

  const ulpTanpaPiket = ulps.filter(u => !activeUlpIds.has(u.id))

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Form / Active notice */}
      {canManage && (
        <div ref={formRef} className="shrink-0 border-b-2 border-neo-black">
          {ulpTanpaPiket.length === 0 && activePikets.length > 0 ? (
            <div className="px-6 py-3 flex items-center gap-3 bg-[#1DB954]/10">
              <span className="text-xl">✅</span>
              <div>
                <span className="font-black text-neo-black text-sm">
                  {SHIFT_LABEL[activePikets[0].shift_type.nama]} sedang aktif untuk semua ULP
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {fmtJam(activePikets[0].shift_type.jam_mulai)}–{fmtJam(activePikets[0].shift_type.jam_selesai)}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 max-w-5xl mx-auto">
              {activePikets.length === 0 && (
                <div className="mb-4 px-4 py-3 border-2 border-pln-red bg-pln-red/10 flex items-start gap-3 shadow-neo">
                   <span className="text-xl mt-0.5">⚠️</span>
                   <div>
                     <p className="font-black text-pln-red">Piket Belum Diisi!</p>
                     <p className="text-sm font-medium text-pln-red/80 mt-0.5">
                       Anda harus mengisi shift piket agar dapat menggunakan aplikasi (Dashboard, Laporan, dll).
                     </p>
                   </div>
                </div>
              )}
              
              <div className="border-2 border-neo-black shadow-neo">
                <div className="px-4 py-3 border-b-2 border-neo-black bg-pln-yellow flex items-center gap-3 flex-wrap">
                  <span className="font-black text-neo-black">+ Buat Piket Baru</span>
                  {currentShiftType && (
                    <span className="text-xs font-bold text-neo-black/70">
                      {SHIFT_LABEL[currentShiftType.nama]} · {fmtJam(currentShiftType.jam_mulai)}–{fmtJam(currentShiftType.jam_selesai)} · {formatTanggal(today + 'T00:00:00')}
                    </span>
                  )}
                  {activePikets.length > 0 && (
                    <span className="ml-auto text-xs font-bold text-pln-red bg-white px-2 py-1 border-2 border-neo-black">
                      Belum aktif di: {ulpTanpaPiket.map(u => u.nama).join(', ')}
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-6">
                  {/* Bagian Atas: Input CC & Ceklis ULP */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-bold text-neo-black block mb-2">
                        Nama CC <span className="text-pln-red">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nama petugas Command Center..."
                        value={namaCC}
                        onChange={(e) => setNamaCC(e.target.value)}
                        className="neo-input w-full px-3 py-2 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-neo-black block mb-2">
                        Pilih ULP <span className="text-pln-red">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ulps.map(ulp => {
                          const isActive = activeUlpIds.has(ulp.id)
                          return (
                            <label key={ulp.id} className={`flex items-center gap-2 border-2 px-3 py-1.5 cursor-pointer transition-colors ${selectedUlps.includes(ulp.id) ? 'border-neo-black bg-neo-black text-white' : 'border-neo-gray bg-white text-gray-500'} ${isActive ? 'opacity-50' : ''}`}>
                               <input 
                                 type="checkbox" 
                                 className="hidden" 
                                 checked={selectedUlps.includes(ulp.id)} 
                                 onChange={() => toggleUlp(ulp.id)} 
                               />
                               <span className="text-xs font-black">{ulp.nama}</span>
                               {isActive && <span className="text-[10px]">✅</span>}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Petugas grid */}
                  <div className="space-y-4">
                    {selectedUlps.map(uId => {
                      const ulp = ulps.find(u => u.id === uId)
                      const uReguList = reguList.filter(r => r.ulp_id === uId)
                      if (!ulp || uReguList.length === 0) return null
                      
                      return (
                        <div key={uId} className="border-2 border-neo-gray p-3">
                          <p className="text-xs font-black text-neo-black mb-2 uppercase tracking-wide bg-neo-gray inline-block px-2 py-0.5">Regu ULP {ulp.nama}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {uReguList.map((regu) => {
                              const slots = petugasAssign[regu.id] ?? ['', '']
                              return (
                                <div key={regu.id} className="flex items-center gap-2 border border-neo-gray px-2 py-1.5">
                                  <span className="text-xs font-black text-neo-black w-16 shrink-0">{regu.nama}</span>
                                  {([0, 1] as const).map((slot) => (
                                    <select
                                      key={slot}
                                      value={slots[slot]}
                                      onChange={(e) => setSlot(regu.id, slot, e.target.value)}
                                      className="neo-input px-2 py-1 text-xs flex-1"
                                    >
                                      <option value="">— Pilih —</option>
                                      {petugasMaster
                                        .filter(p => p.ulp_id === uId)
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
                      )
                    })}
                  </div>

                  {error && <p className="text-sm font-medium text-pln-red bg-pln-red/10 px-3 py-2 border border-pln-red">{error}</p>}

                  <div className="flex justify-end pt-2 border-t-2 border-neo-black border-dashed">
                    <Button variant="primary" loading={loading} onClick={handleBuat} className="w-full sm:w-auto text-base">
                      Buat Piket {selectedUlps.length > 0 ? `(${selectedUlps.length} ULP)` : ''}
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
                ulpName={ulps.find(u => u.id === piket.ulp_id)?.nama ?? 'Unknown'}
                reguList={reguList}
                canManage={canManage}
                isActive={activeUlpIds.has(piket.ulp_id) && activePikets.some(p => p.id === piket.id)}
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
  ulpName,
  reguList,
  canManage,
  isActive,
  onHapus,
  onPakai,
}: {
  piket: PiketRow
  ulpName: string
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
          <span className="px-2 py-0.5 bg-neo-black text-white text-xs font-black">
            {ulpName}
          </span>
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
              ♻️ Pakai
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
