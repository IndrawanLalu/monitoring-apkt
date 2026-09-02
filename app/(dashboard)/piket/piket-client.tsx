'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SHIFT_LABEL } from '@/constants'
import { formatTanggal } from '@/lib/utils/format'
import type { ShiftType } from '@/types'
import { useKonfirmasi } from '@/components/ui/konfirmasi'

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
  const nowWita = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const nowM = nowWita.getUTCHours() * 60 + nowWita.getUTCMinutes()
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export function PiketClient({ ulps, role, piketList: initial, shiftTypes, reguList, petugasMaster }: Props) {
  const konfirmasi = useKonfirmasi()
  const [piketList, setPiketList] = useState<PiketRow[]>(initial)
  const [namaCC, setNamaCC] = useState('')
  const [selectedUlps, setSelectedUlps] = useState<string[]>(ulps.map(u => u.id))
  const [petugasAssign, setPetugasAssign] = useState<Record<string, [string, string]>>(() =>
    Object.fromEntries(reguList.map((r) => [r.id, ['', '']]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Semua peran operasional boleh mengelola piket. Nilai lama tetap disebut
  // agar akun yang belum termigrasi tidak kehilangan akses.
  const canManage = ['super_admin', 'uiw', 'up3', 'operator', 'admin', 'supervisor', 'cc'].includes(role)

  const todayDate = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const today = todayDate.toISOString().split('T')[0]

  const activePikets = piketList.filter(
    (p) => p.tanggal === today && isShiftActive(p.shift_type.jam_mulai, p.shift_type.jam_selesai),
  )
  const activeUlpIds = new Set(activePikets.map(p => p.ulp_id))
  const currentShiftType = shiftTypes.find((s) => isShiftActive(s.jam_mulai, s.jam_selesai))
  const ulpTanpaPiket = ulps.filter(u => !activeUlpIds.has(u.id))

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
    if (!selectedUlps.includes(piket.ulp_id)) setSelectedUlps(prev => [...prev, piket.ulp_id])
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
          body: JSON.stringify({ ulp_id: uId, shift_type_id: currentShiftType.id, tanggal: today, nama_cc: namaCC.trim(), petugas_assignments }),
        })
        const json = await res.json() as { data: PiketRow; error: string | null }
        if (!res.ok || json.error) {
          if (res.status !== 409) throw new Error(json.error ?? 'Gagal membuat piket')
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
        const newIds = new Set(newPikets.map(p => p.id))
        setPiketList((prev) => [...newPikets, ...prev.filter(p => !newIds.has(p.id))])
        setNamaCC('')
        setPetugasAssign(Object.fromEntries(reguList.map((r) => [r.id, ['', '']])))
      } else {
        setError('Piket untuk ULP tersebut sudah dibuat.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleHapus(id: string) {
    const ok = await konfirmasi({
      judul: 'Hapus piket ini?',
      pesan: 'Jadwal piket beserta penugasan petugasnya akan dihapus permanen.',
      varian: 'danger',
    })
    if (!ok) return
    await fetch(`/api/piket/${id}`, { method: 'DELETE' })
    setPiketList((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

      {/* Kiri: Form */}
      {canManage && (
        <div ref={formRef} style={{ width: '52%', maxWidth: 580, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {/* Semua ULP sudah aktif */}
          {ulpTanpaPiket.length === 0 && activePikets.length > 0 ? (
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'rgba(29,185,84,0.1)' }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <span style={{ fontWeight: 700, color: '#1DB954', fontSize: 14 }}>
                  {SHIFT_LABEL[activePikets[0].shift_type.nama]} sedang aktif untuk semua ULP
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {fmtJam(activePikets[0].shift_type.jam_mulai)}–{fmtJam(activePikets[0].shift_type.jam_selesai)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 20px', width: '100%' }}>
              {/* Warning belum ada piket */}
              {activePikets.length === 0 && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(228,0,43,0.08)', border: '1px solid rgba(228,0,43,0.25)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, marginTop: 1 }}>⚠️</span>
                  <div>
                    <p style={{ fontWeight: 700, color: '#E4002B', margin: 0, fontSize: 14 }}>Piket Belum Diisi!</p>
                    <p style={{ fontSize: 12, color: '#E4002B', opacity: 0.8, margin: '3px 0 0' }}>
                      Anda harus mengisi shift piket agar dapat menggunakan aplikasi (Dashboard, Laporan, dll).
                    </p>
                  </div>
                </div>
              )}

              {/* Form Card */}
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {/* Card Header */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>+ Buat Piket Baru</span>
                    {currentShiftType && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {SHIFT_LABEL[currentShiftType.nama]} · {fmtJam(currentShiftType.jam_mulai)}–{fmtJam(currentShiftType.jam_selesai)} · {formatTanggal(today + 'T00:00:00')}
                      </span>
                    )}
                  </div>
                  {activePikets.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#E4002B', backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)', borderRadius: 6, padding: '2px 8px' }}>
                      Belum aktif: {ulpTanpaPiket.map(u => u.nama).join(', ')}
                    </span>
                  )}
                </div>

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Baris: Nama CC & Pilih ULP */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Nama CC */}
                    <Input
                      label="Nama CC *"
                      placeholder="Nama petugas Command Center..."
                      value={namaCC}
                      onChange={(e) => setNamaCC(e.target.value)}
                    />

                    {/* ULP Selector */}
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
                        Pilih ULP <span style={{ color: '#E4002B' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {ulps.map(ulp => {
                          const isSelected = selectedUlps.includes(ulp.id)
                          const isAlreadyActive = activeUlpIds.has(ulp.id)

                          return (
                            <button
                              key={ulp.id}
                              type="button"
                              onClick={() => !isAlreadyActive && toggleUlp(ulp.id)}
                              title={isAlreadyActive ? 'ULP ini sudah memiliki piket aktif' : ulp.nama}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: '2px solid',
                                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                                backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-surface-2)',
                                color: isSelected ? '#fff' : 'var(--text-secondary)',
                                cursor: isAlreadyActive ? 'not-allowed' : 'pointer',
                                opacity: isAlreadyActive ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                                fontSize: 13,
                                fontWeight: 600,
                                outline: 'none',
                              }}
                            >
                              {/* Checkmark / empty box */}
                              <span style={{
                                width: 16,
                                height: 16,
                                borderRadius: 4,
                                border: isSelected ? 'none' : '2px solid var(--border-strong)',
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: 11,
                                fontWeight: 800,
                              }}>
                                {isSelected && '✓'}
                              </span>
                              {ulp.nama}
                              {isAlreadyActive && (
                                <span style={{ fontSize: 10, opacity: 0.8 }}>✅</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Petugas Assignment per ULP */}
                  {selectedUlps.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedUlps.map(uId => {
                        const ulp = ulps.find(u => u.id === uId)
                        const uReguList = reguList.filter(r => r.ulp_id === uId)
                        if (!ulp || uReguList.length === 0) return null

                        return (
                          <div key={uId} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                            {/* Sub-header ULP */}
                            <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Regu — {ulp.nama}
                              </span>
                            </div>
                            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                              {uReguList.map((regu) => {
                                const slots = petugasAssign[regu.id] ?? ['', '']
                                return (
                                  <div key={regu.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', width: 60, flexShrink: 0 }}>{regu.nama}</span>
                                    {([0, 1] as const).map((slot) => (
                                      <select
                                        key={slot}
                                        value={slots[slot]}
                                        onChange={(e) => setSlot(regu.id, slot, e.target.value)}
                                        className="input"
                                        style={{ flex: 1, fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}
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
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)' }}>
                      <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>⚠ {error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                    <Button variant="primary" loading={loading} onClick={handleBuat} size="lg">
                      Buat Piket {selectedUlps.length > 0 ? `(${selectedUlps.length} ULP)` : ''}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kanan: Riwayat */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Riwayat Piket
            </h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>30 hari terakhir</span>
          </div>
          {piketList.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 12, backgroundColor: 'var(--bg-surface-2)' }}>
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

function PiketCard({ piket, ulpName, reguList, canManage, isActive, onHapus, onPakai }: {
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
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: isActive ? '0 0 0 2px #1DB954, var(--shadow-sm)' : 'var(--shadow-sm)',
    }}>
      {/* Card Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        backgroundColor: isActive ? 'rgba(29,185,84,0.12)' : 'var(--bg-surface-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* ULP badge */}
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 5,
            backgroundColor: isActive ? '#1DB954' : 'var(--accent)',
            color: '#fff',
          }}>
            {ulpName}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {SHIFT_LABEL[shift.nama]} — {formatTanggal(piket.tanggal + 'T00:00:00')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtJam(shift.jam_mulai)}–{fmtJam(shift.jam_selesai)}
          </span>
          {piket.nama_cc && (
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
              👤 {piket.nama_cc}
            </span>
          )}
          {isActive && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, backgroundColor: '#1DB954', color: '#fff', letterSpacing: '0.04em' }}>
              ● AKTIF
            </span>
          )}
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Button variant="yellow" size="sm" onClick={() => onPakai(piket)}>♻️ Pakai</Button>
            <Button variant="danger" size="sm" onClick={() => onHapus(piket.id)}>Hapus</Button>
          </div>
        )}
      </div>

      {/* Petugas Grid */}
      {reguWithPetugas.length > 0 ? (
        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {reguWithPetugas.map((regu) => (
            <div key={regu.id}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{regu.nama}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{petugasByRegu[regu.id].join(' & ')}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Tidak ada data petugas
        </div>
      )}
    </div>
  )
}
