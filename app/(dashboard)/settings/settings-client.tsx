'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { WA_SESSION_STATUS } from '@/constants'
import type { Regu, Petugas, WaSessionStatus } from '@/types'
import Image from 'next/image'

interface WaSession {
  id: string
  user_id: string
  status: WaSessionStatus
  session_data: Record<string, unknown> | null
  updated_at: string
}

interface Props {
  profile: { ulp_id: string; role: string; ulp: { id: string; nama: string; kode: string; wa_grup_id: string | null }; userId?: string }
  reguList: Regu[]
  petugasList: Petugas[]
  waSession: WaSession | null
}

type Tab = 'wa' | 'regu' | 'petugas'

export function SettingsClient({ profile, reguList: initialRegu, petugasList: initialPetugas, waSession: initialWa }: Props) {
  const [tab, setTab] = useState<Tab>('wa')
  const [waSession, setWaSession] = useState<WaSession | null>(initialWa)
  const [reguList, setReguList] = useState<Regu[]>(initialRegu)
  const [petugasList, setPetugasList] = useState<Petugas[]>(initialPetugas)
  const [waGrupId, setWaGrupId] = useState(profile.ulp.wa_grup_id ?? '')
  const [initLoading, setInitLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pairingLoading, setPairingLoading] = useState(false)
  const [linkMode, setLinkMode] = useState<'qr' | 'phone'>('phone')
  const [grupList, setGrupList] = useState<{ nama: string; id: string }[]>([])
  const [loadingGrup, setLoadingGrup] = useState(false)

  const ulpId = profile.ulp_id
  const userId = profile.userId

  // Realtime WA session updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`wa_session_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wa_session',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setWaSession(payload.new as WaSession)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ulpId])

  async function handleInit() {
    setInitLoading(true)
    await fetch('/api/wa/init', { method: 'POST' })
    setInitLoading(false)
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    await fetch('/api/wa/disconnect', { method: 'POST' })
    setWaSession((prev) => prev ? { ...prev, status: 'disconnected', session_data: null } : null)
    setGrupList([])
    setDisconnecting(false)
  }

  async function handleRefreshStatus() {
    await fetch('/api/wa/sync-status', { method: 'POST' })
    const supabase = createClient()
    const { data } = await supabase
      .from('wa_session')
      .select('id, user_id, status, session_data, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (data) setWaSession(data as WaSession)
  }

  async function handleFetchGrup() {
    setLoadingGrup(true)
    const res = await fetch('/api/wa/groups', { method: 'POST' })
    const json = await res.json()
    setGrupList(json.data ?? [])
    setLoadingGrup(false)
  }

  async function handleSaveGrupId() {
    await fetch(`/api/ulp/${ulpId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wa_grup_id: waGrupId }),
    })
  }

  async function handlePairingCode() {
    if (!phoneNumber.trim()) return
    setPairingLoading(true)
    await fetch('/api/wa/pairing-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber.trim() }),
    })
    setPairingLoading(false)
  }

  const sessionData = waSession?.session_data as { qr?: string; pairing_code?: string; wa_number?: string } | null
  const qrDataUrl = waSession?.status === 'scanning' ? sessionData?.qr : null
  const pairingCode = waSession?.status === 'scanning' ? sessionData?.pairing_code : null
  const waNumber = waSession?.status === 'connected' ? sessionData?.wa_number : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b-2 border-neo-black">
        {([
          { key: 'wa', label: '📱 WhatsApp' },
          { key: 'regu', label: '👷 Regu & Petugas' },
          { key: 'petugas', label: '👤 Petugas' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-bold border-r-2 border-neo-black transition-colors ${
              tab === key ? 'bg-pln-yellow text-neo-black' : 'bg-neo-white text-neo-black hover:bg-neo-gray'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* ── WA TAB ── */}
        {tab === 'wa' && (
          <div className="max-w-lg mx-auto flex flex-col gap-4">
            <h2 className="text-xl font-black uppercase tracking-wide">Koneksi WhatsApp</h2>

            {/* Status card */}
            <Card>
              <div className={`p-4 border-b-2 border-neo-black font-black text-sm uppercase tracking-wide flex items-center justify-between ${
                waSession?.status === WA_SESSION_STATUS.CONNECTED ? 'bg-pln-green text-white' :
                waSession?.status === WA_SESSION_STATUS.SCANNING ? 'bg-pln-yellow text-neo-black' :
                waSession?.status === WA_SESSION_STATUS.LOADING ? 'bg-pln-blue-mid text-white' :
                'bg-neo-gray text-neo-black'
              }`}>
                <span>Status: {waSession?.status === WA_SESSION_STATUS.CONNECTED ? '✅ Terhubung' :
                         waSession?.status === WA_SESSION_STATUS.SCANNING ? '🔄 Menunggu Kode' :
                         waSession?.status === WA_SESSION_STATUS.LOADING ? '⏳ Memuat...' :
                         '⭕ Tidak Terhubung'}</span>
                <button onClick={handleRefreshStatus} className="text-xs font-medium opacity-70 hover:opacity-100 underline normal-case">
                  refresh
                </button>
              </div>
              <div className="p-4">
                {waSession?.status === WA_SESSION_STATUS.CONNECTED && (
                  <div className="mb-4">
                    <p className="text-sm font-bold">Nomor WA: <span className="font-mono">{waNumber ?? '—'}</span></p>
                    <p className="text-xs text-gray-500 mt-1">Nomor ini yang mengirim pesan ke grup</p>
                  </div>
                )}

                {/* Pairing code display */}
                {pairingCode && (
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <p className="text-sm font-bold text-center">Masukkan kode ini di WhatsApp HP kamu</p>
                    <p className="text-xs text-gray-500 text-center">
                      WhatsApp → Setelan → Perangkat Tertaut → Tautkan Perangkat → Tautkan via Nomor HP
                    </p>
                    <div className="neo-border px-6 py-3 bg-pln-yellow text-center">
                      <span className="font-black text-3xl tracking-widest font-mono text-neo-black">
                        {pairingCode}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Kode berlaku beberapa menit</p>
                  </div>
                )}

                {/* QR code display */}
                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <p className="text-sm font-bold text-center">Scan QR ini dengan WhatsApp di HP Anda</p>
                    <div className="neo-border p-2">
                      <Image src={qrDataUrl} alt="QR Code WhatsApp" width={240} height={240} unoptimized />
                    </div>
                    <p className="text-xs text-gray-500">QR akan otomatis refresh jika kadaluarsa</p>
                  </div>
                )}

                {waSession?.status === WA_SESSION_STATUS.LOADING && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-4 border-2 border-pln-blue border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">Memulai WhatsApp client...</p>
                  </div>
                )}

                {/* Connect buttons */}
                {(!waSession || waSession.status === WA_SESSION_STATUS.DISCONNECTED) && (
                  <div className="flex flex-col gap-3">
                    {/* Reconnect with saved session */}
                    <Button variant="primary" loading={initLoading} onClick={handleInit} className="w-full">
                      🔄 Hubungkan Kembali
                    </Button>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-neo-gray" />
                      <span className="text-xs text-gray-400">atau tautkan ulang</span>
                      <div className="flex-1 h-px bg-neo-gray" />
                    </div>

                    {/* Mode toggle */}
                    <div className="flex border-2 border-neo-black">
                      <button
                        onClick={() => setLinkMode('phone')}
                        className={`flex-1 py-1.5 text-xs font-bold transition-colors ${linkMode === 'phone' ? 'bg-pln-blue text-white' : 'bg-white text-neo-black hover:bg-neo-gray'}`}
                      >
                        📱 via Nomor HP
                      </button>
                      <button
                        onClick={() => setLinkMode('qr')}
                        className={`flex-1 py-1.5 text-xs font-bold border-l-2 border-neo-black transition-colors ${linkMode === 'qr' ? 'bg-pln-blue text-white' : 'bg-white text-neo-black hover:bg-neo-gray'}`}
                      >
                        📷 via QR Code
                      </button>
                    </div>

                    {linkMode === 'phone' && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="tel"
                          placeholder="Nomor WA (contoh: 08123456789)"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="neo-input px-3 py-2 text-sm w-full"
                        />
                        <Button variant="secondary" loading={pairingLoading} onClick={handlePairingCode} className="w-full">
                          Dapatkan Kode Tautan
                        </Button>
                      </div>
                    )}

                    {linkMode === 'qr' && (
                      <Button variant="secondary" loading={initLoading} onClick={handleInit} className="w-full">
                        Tampilkan QR Code
                      </Button>
                    )}
                  </div>
                )}

                {waSession?.status === WA_SESSION_STATUS.CONNECTED && (
                  <Button variant="danger" loading={disconnecting} onClick={handleDisconnect} className="flex-1">
                    Putuskan Koneksi
                  </Button>
                )}
                {(waSession?.status === WA_SESSION_STATUS.LOADING || waSession?.status === WA_SESSION_STATUS.SCANNING) && (
                  <Button variant="danger" loading={disconnecting} onClick={handleDisconnect} className="flex-1">
                    Batalkan
                  </Button>
                )}
              </div>
            </Card>

            {/* Grup WA ID */}
            <Card>
              <div className="p-4 border-b-2 border-neo-black bg-neo-gray">
                <h3 className="font-black text-sm">Konfigurasi Grup WhatsApp</h3>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <Input
                  label="ID Grup WhatsApp"
                  placeholder="628xxx@g.us"
                  value={waGrupId}
                  onChange={(e) => setWaGrupId(e.target.value)}
                  hint="Klik 'Ambil Daftar Grup' lalu pilih grup yang sesuai"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" loading={loadingGrup} onClick={handleFetchGrup} className="flex-1">
                    📋 Ambil Daftar Grup
                  </Button>
                  <Button variant="primary" onClick={handleSaveGrupId} className="flex-1">
                    Simpan
                  </Button>
                </div>
                {grupList.length > 0 && (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    <p className="text-xs font-bold text-gray-500 uppercase">Pilih grup:</p>
                    {grupList.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setWaGrupId(g.id)}
                        className={`text-left px-3 py-2 text-sm neo-border transition-colors ${waGrupId === g.id ? 'bg-pln-yellow font-bold' : 'bg-white hover:bg-neo-gray'}`}
                      >
                        <div className="font-medium">{g.nama}</div>
                        <div className="text-xs text-gray-400 font-mono truncate">{g.id}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── REGU TAB ── */}
        {tab === 'regu' && (
          <ReguTab ulpId={ulpId} reguList={reguList} setReguList={setReguList} />
        )}

        {/* ── PETUGAS TAB ── */}
        {tab === 'petugas' && (
          <PetugasTab ulpId={ulpId} reguList={reguList} petugasList={petugasList} setPetugasList={setPetugasList} />
        )}
      </div>
    </div>
  )
}

/* ── REGU SUB-COMPONENT ── */
function ReguTab({ ulpId, reguList, setReguList }: { ulpId: string; reguList: Regu[]; setReguList: React.Dispatch<React.SetStateAction<Regu[]>> }) {
  const [namaRegu, setNamaRegu] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTambah() {
    if (!namaRegu.trim()) return
    setLoading(true)
    const res = await fetch('/api/regu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulp_id: ulpId, nama: namaRegu.trim() }),
    })
    const json = await res.json()
    if (json.data) {
      setReguList((prev) => [...prev, json.data].sort((a, b) => a.nama.localeCompare(b.nama)))
      setNamaRegu('')
    }
    setLoading(false)
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus regu ini? Semua petugas di regu ini akan kehilangan regu.')) return
    await fetch(`/api/regu/${id}`, { method: 'DELETE' })
    setReguList((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-black uppercase tracking-wide mb-4">Manajemen Regu</h2>

      <Card className="mb-4">
        <div className="p-4 border-b-2 border-neo-black bg-pln-yellow">
          <h3 className="font-black text-sm">+ Tambah Regu</h3>
        </div>
        <div className="p-4 flex gap-2">
          <Input
            placeholder="Nama regu (contoh: Regu 1)"
            value={namaRegu}
            onChange={(e) => setNamaRegu(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTambah()}
            className="flex-1"
          />
          <Button variant="primary" loading={loading} onClick={handleTambah}>Tambah</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {reguList.map((regu) => (
          <div key={regu.id} className="neo-border flex items-center justify-between p-3 bg-white">
            <span className="font-bold text-sm">{regu.nama}</span>
            <Button variant="danger" size="sm" onClick={() => handleHapus(regu.id)}>Hapus</Button>
          </div>
        ))}
        {reguList.length === 0 && (
          <div className="neo-border p-4 text-center text-sm text-gray-400 bg-neo-gray">
            Belum ada regu
          </div>
        )}
      </div>
    </div>
  )
}

/* ── PETUGAS SUB-COMPONENT ── */
function PetugasTab({ ulpId, reguList, petugasList, setPetugasList }: {
  ulpId: string
  reguList: Regu[]
  petugasList: Petugas[]
  setPetugasList: React.Dispatch<React.SetStateAction<Petugas[]>>
}) {
  const [nama, setNama] = useState('')
  const [nomorHp, setNomorHp] = useState('')
  const [reguId, setReguId] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTambah() {
    if (!nama.trim()) return
    setLoading(true)
    const res = await fetch('/api/petugas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulp_id: ulpId, regu_id: reguId || null, nama: nama.trim(), nomor_hp: nomorHp || null }),
    })
    const json = await res.json()
    if (json.data) {
      setPetugasList((prev) => [...prev, json.data].sort((a, b) => a.nama.localeCompare(b.nama)))
      setNama('')
      setNomorHp('')
    }
    setLoading(false)
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus petugas ini?')) return
    await fetch(`/api/petugas/${id}`, { method: 'DELETE' })
    setPetugasList((prev) => prev.filter((p) => p.id !== id))
  }

  const reguMap = Object.fromEntries(reguList.map((r) => [r.id, r.nama]))

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-black uppercase tracking-wide mb-4">Manajemen Petugas</h2>

      <Card className="mb-4">
        <div className="p-4 border-b-2 border-neo-black bg-pln-yellow">
          <h3 className="font-black text-sm">+ Tambah Petugas</h3>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <Input label="Nama Petugas" placeholder="Budi Santoso" value={nama} onChange={(e) => setNama(e.target.value)} />
          <Input label="Nomor HP" placeholder="081234567890" value={nomorHp} onChange={(e) => setNomorHp(e.target.value)} />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-bold text-neo-black block mb-1">
                Regu Default <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <select
                value={reguId}
                onChange={(e) => setReguId(e.target.value)}
                className="neo-input w-full px-3 py-2 text-sm font-medium"
              >
                <option value="">— Tanpa regu default —</option>
                {reguList.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="primary" loading={loading} onClick={handleTambah}>Tambah</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {petugasList.map((p) => (
          <div key={p.id} className="neo-border flex items-center justify-between p-3 bg-white">
            <div>
              <div className="font-bold text-sm">{p.nama}</div>
              <div className="text-xs text-gray-500">{p.regu_id ? (reguMap[p.regu_id] ?? '—') : 'Pool umum'} {p.nomor_hp ? `· ${p.nomor_hp}` : ''}</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleHapus(p.id)}>Hapus</Button>
          </div>
        ))}
        {petugasList.length === 0 && (
          <div className="neo-border p-4 text-center text-sm text-gray-400 bg-neo-gray">Belum ada petugas</div>
        )}
      </div>
    </div>
  )
}
