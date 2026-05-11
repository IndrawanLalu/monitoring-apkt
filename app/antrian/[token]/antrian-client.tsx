'use client'

import { useState, useEffect, useCallback } from 'react'
import { STATUS_LABEL, STATUS_EMOJI, STATUS_COLOR } from '@/constants'
import type { StatusLaporan } from '@/constants'

interface QueueItem {
  position: number
  isOwn: boolean
  status: string
}

export interface AntrianData {
  found: boolean
  reguNama?: string
  ulpNama?: string
  myStatus?: string
  myNomor?: string
  isSelesai?: boolean
  myPosition?: number
  totalAntrian?: number
  queue?: QueueItem[]
}

const REFRESH_INTERVAL = 15

export function AntrinanClient({ token, initialData }: { token: string; initialData: AntrianData }) {
  const [data, setData] = useState<AntrianData>(initialData)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/antrian/${token}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as AntrianData
        setData(json)
        setLastUpdated(new Date())
      }
    } finally {
      setRefreshing(false)
      setCountdown(REFRESH_INTERVAL)
    }
  }, [token])

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          void fetchData()
          return REFRESH_INTERVAL
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [fetchData])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) void fetchData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchData])

  if (!data.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neo-white p-4">
        <div className="border-2 border-neo-black shadow-[4px_4px_0px_#1A1A1A] max-w-sm w-full p-6 text-center bg-neo-white">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-black text-neo-black">Link Tidak Valid</h1>
          <p className="text-sm text-gray-500 mt-2">Link antrian ini tidak ditemukan atau sudah tidak aktif.</p>
        </div>
      </div>
    )
  }

  if (data.isSelesai) {
    return (
      <div className="min-h-screen bg-neo-white p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <Header reguNama={data.reguNama!} ulpNama={data.ulpNama!} />
          <div className="border-2 border-neo-black shadow-[4px_4px_0px_#1A1A1A] p-6 text-center" style={{ backgroundColor: '#1DB954' }}>
            <div className="text-5xl mb-3">✅</div>
            <p className="text-white font-black text-xl">Laporan Selesai Ditangani</p>
            <p className="text-green-100 text-sm mt-2">Tiket #{data.myNomor}</p>
            <p className="text-green-100 text-xs mt-1">Terima kasih telah menggunakan layanan PLN</p>
          </div>
          <FooterNote refreshing={refreshing} countdown={countdown} lastUpdated={lastUpdated} onRefresh={fetchData} />
        </div>
      </div>
    )
  }

  const queue = data.queue ?? []
  const myPosition = data.myPosition ?? 0
  const totalAntrian = data.totalAntrian ?? 0

  return (
    <div className="min-h-screen bg-neo-white p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <Header reguNama={data.reguNama!} ulpNama={data.ulpNama!} />

        {/* Posisi antrian */}
        <div className="border-2 border-neo-black shadow-[4px_4px_0px_#1A1A1A] bg-neo-white">
          <div className="p-3 border-b-2 border-neo-black bg-neo-gray">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tiket #{data.myNomor}</p>
          </div>
          <div className="p-6 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Posisi Antrian Anda</p>
            <p className="text-7xl font-black" style={{ color: '#003B8E' }}>{myPosition}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">
              dari <span className="font-black text-neo-black">{totalAntrian}</span> antrian aktif
            </p>
          </div>
          <div className="px-4 pb-5 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 border-2 border-neo-black px-3 py-1.5 text-sm font-black"
              style={{
                backgroundColor: STATUS_COLOR[data.myStatus as StatusLaporan]?.bg ?? '#E4002B',
                color: STATUS_COLOR[data.myStatus as StatusLaporan]?.text ?? '#FFFFFF',
              }}
            >
              {STATUS_EMOJI[data.myStatus as StatusLaporan]}&nbsp;
              {STATUS_LABEL[data.myStatus as StatusLaporan]}
            </span>
          </div>
        </div>

        {/* Daftar antrian */}
        <div className="border-2 border-neo-black shadow-[4px_4px_0px_#1A1A1A] bg-neo-white">
          <div className="p-3 border-b-2 border-neo-black bg-neo-gray">
            <h3 className="font-black text-sm">Antrian {data.reguNama}</h3>
          </div>
          {queue.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Tidak ada antrian aktif</div>
          ) : (
            <div className="divide-y-2 divide-neo-black">
              {queue.map((item) => (
                <div
                  key={item.position}
                  className="flex items-center gap-3 px-4 py-3"
                  style={item.isOwn ? { backgroundColor: '#FFF9CC' } : {}}
                >
                  <span
                    className="text-base font-black w-7 text-center shrink-0"
                    style={{ color: item.isOwn ? '#003B8E' : '#9CA3AF' }}
                  >
                    {item.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: item.isOwn ? '#003B8E' : '#1A1A1A' }}>
                      Antrian #{item.position}
                      {item.isOwn && <span className="ml-1.5 text-xs font-black text-pln-blue">(Anda)</span>}
                    </p>
                  </div>
                  <span
                    className="shrink-0 border border-neo-black px-2 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: STATUS_COLOR[item.status as StatusLaporan]?.bg ?? '#E4002B',
                      color: STATUS_COLOR[item.status as StatusLaporan]?.text ?? '#FFFFFF',
                    }}
                  >
                    {STATUS_EMOJI[item.status as StatusLaporan]}&nbsp;
                    {STATUS_LABEL[item.status as StatusLaporan]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <FooterNote refreshing={refreshing} countdown={countdown} lastUpdated={lastUpdated} onRefresh={fetchData} />
      </div>
    </div>
  )
}

function Header({ reguNama, ulpNama }: { reguNama: string; ulpNama: string }) {
  return (
    <div className="border-2 border-neo-black shadow-[4px_4px_0px_#1A1A1A] p-4 text-center" style={{ backgroundColor: '#003B8E' }}>
      <span className="text-3xl">⚡</span>
      <h1 className="text-white font-black text-lg mt-1">Antrian Laporan PLN</h1>
      <p className="text-blue-200 text-xs mt-0.5">{reguNama} · {ulpNama}</p>
    </div>
  )
}

function FooterNote({
  refreshing, countdown, lastUpdated, onRefresh,
}: {
  refreshing: boolean
  countdown: number
  lastUpdated: Date | null
  onRefresh: () => void
}) {
  return (
    <div className="text-center pb-6 space-y-1">
      <p className="text-xs text-gray-400">
        {refreshing ? 'Memperbarui...' : `Perbarui otomatis dalam ${countdown} detik`}
      </p>
      {lastUpdated && (
        <p className="text-xs text-gray-400">
          Terakhir diperbarui:{' '}
          {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      )}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="text-xs font-bold underline disabled:opacity-40"
        style={{ color: '#003B8E' }}
      >
        Perbarui Sekarang
      </button>
    </div>
  )
}
