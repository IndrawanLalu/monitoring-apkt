'use client'

import { useState } from 'react'
import { STATUS_COLOR, STATUS_LABEL } from '@/constants'
import type { StatusLaporan } from '@/types'

type StatusCount = Record<StatusLaporan, number>

export interface ReguSummary {
  id: string
  nama: string
  petugas: string[]
  stats: StatusCount
  total: number
}

export interface UlpSummary {
  id: string
  nama: string
  stats: StatusCount
  total: number
  regus: ReguSummary[]
}

export interface RekapData {
  total: StatusCount
  totalLaporan: number
  ulps: UlpSummary[]
  tanggal: string
  callback: {
    total: number
    statusCount: Record<string, number>
  }
}

function StatusPills({ stats, total }: { stats: StatusCount, total: number }) {
  if (total === 0) return <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 border border-gray-300">NIHIL</span>
  
  const order: StatusLaporan[] = ['lapor', 'ditangani', 'nyala_sementara', 'selesai']
  return (
    <div className="flex flex-wrap gap-1">
      {order.map(s => stats[s] > 0 && (
        <span 
          key={s} 
          className="px-1.5 py-0.5 text-[10px] font-black border border-neo-black whitespace-nowrap"
          style={{ backgroundColor: STATUS_COLOR[s].bg, color: STATUS_COLOR[s].text }}
        >
          {stats[s]} {STATUS_LABEL[s].split(' ')[0]}
        </span>
      ))}
      <span className="px-1.5 py-0.5 text-[10px] font-black bg-neo-black text-white border border-neo-black">
        {total} Tot
      </span>
    </div>
  )
}

function ProgressBar({ stats, total }: { stats: StatusCount, total: number }) {
  if (total === 0) return <div className="h-1.5 w-full bg-gray-200" />
  const order: StatusLaporan[] = ['lapor', 'ditangani', 'nyala_sementara', 'selesai']
  
  return (
    <div className="flex h-1.5 w-full bg-gray-200 overflow-hidden">
      {order.map(s => stats[s] > 0 && (
        <div 
          key={s} 
          style={{ 
            width: `${(stats[s] / total) * 100}%`,
            backgroundColor: STATUS_COLOR[s].bg 
          }}
        />
      ))}
    </div>
  )
}

export function RekapClient({ data }: { data: RekapData }) {
  // Semua ULP terbuka secara default di mobile mungkin terlalu panjang, kita track state expand-nya
  const [expandedUlp, setExpandedUlp] = useState<Record<string, boolean>>(
    // Buka semua secara default
    data.ulps.reduce((acc, ulp) => ({ ...acc, [ulp.id]: true }), {})
  )

  const toggleUlp = (id: string) => setExpandedUlp(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 border-b-4 border-neo-black bg-pln-yellow shadow-neo-sm">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-black text-neo-black uppercase tracking-widest">⚡ Rekap Harian</h1>
            <span className="text-xs font-bold bg-neo-white border-2 border-neo-black px-2 py-1">
              {data.tanggal}
            </span>
          </div>
          
          {/* Global Summary */}
          <div className="bg-neo-white border-2 border-neo-black p-3 mt-2 shadow-sm">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">TOTAL GANGGUAN HARI INI</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(['lapor', 'ditangani', 'nyala_sementara', 'selesai'] as StatusLaporan[]).map(s => (
                <div key={s} className="flex-1 min-w-[70px]">
                  <div 
                    className="border-2 border-neo-black px-2 py-1.5 text-center flex flex-col items-center justify-center"
                    style={{ backgroundColor: STATUS_COLOR[s].bg }}
                  >
                    <span className="text-xl font-black" style={{ color: STATUS_COLOR[s].text }}>{data.total[s]}</span>
                    <span className="text-[9px] font-bold uppercase truncate w-full text-center" style={{ color: STATUS_COLOR[s].text }}>
                      {STATUS_LABEL[s]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-center bg-neo-black text-white py-1 text-sm font-black uppercase tracking-widest">
              TOTAL KESELURUHAN: {data.totalLaporan}
            </div>
          </div>

          {/* Callback Summary */}
          {data.callback.total > 0 && (
            <div className="bg-pln-blue text-white border-2 border-neo-black p-3 mt-2 shadow-sm flex flex-col items-center">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-wider mb-1">TOTAL CC CALL BACK HARI INI</p>
              <span className="text-3xl font-black">{data.callback.total}</span>
              <div className="flex gap-2 mt-1 w-full justify-center">
                {Object.entries(data.callback.statusCount).map(([k, v]) => (
                  <span key={k} className="text-[10px] font-bold bg-white text-pln-blue px-2 py-0.5 uppercase border border-neo-black">
                    {v} {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ULP List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {data.ulps.length === 0 ? (
          <div className="text-center py-10 opacity-50 font-bold">Belum ada ULP.</div>
        ) : (
          data.ulps.map((ulp) => {
            const isExpanded = expandedUlp[ulp.id]
            const isZero = ulp.total === 0

            return (
              <div key={ulp.id} className="border-4 border-neo-black bg-neo-white shadow-neo">
                {/* ULP Header - Click to toggle */}
                <button 
                  onClick={() => toggleUlp(ulp.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between bg-pln-blue text-white active:bg-blue-800 transition-colors"
                >
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wider">{ulp.nama}</h2>
                    <div className="mt-1 opacity-90">
                      {isZero ? (
                        <span className="text-[10px] font-bold bg-white text-pln-blue px-2 py-0.5 rounded-full">NIHIL</span>
                      ) : (
                        <div className="text-[10px] font-bold">
                          Selesai: {ulp.stats.selesai} / {ulp.total}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xl font-black">{isExpanded ? '−' : '+'}</span>
                </button>
                
                {/* Progress bar ULP */}
                <ProgressBar stats={ulp.stats} total={ulp.total} />

                {/* ULP Content (Regus) */}
                {isExpanded && (
                  <div className="p-3 bg-[#FAFAFA] space-y-3">
                    {ulp.regus.length === 0 ? (
                      <p className="text-xs text-center text-gray-400 font-bold py-2">Tidak ada regu terdaftar.</p>
                    ) : (
                      ulp.regus.map((regu) => (
                        <div key={regu.id} className="border-2 border-neo-black bg-neo-white p-2">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-black text-sm uppercase text-neo-black">{regu.nama}</h3>
                            <StatusPills stats={regu.stats} total={regu.total} />
                          </div>
                          
                          {/* Petugas List */}
                          <div className="bg-pln-yellow/20 border border-pln-yellow p-1.5 mt-1">
                            <span className="text-[9px] font-black uppercase text-pln-orange mb-0.5 block">👷 Petugas Piket:</span>
                            <p className="text-[11px] font-medium text-neo-black leading-tight">
                              {regu.petugas.length > 0 ? regu.petugas.join(' • ') : <span className="text-gray-400 italic">Tidak ada petugas terdata di piket hari ini</span>}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="text-center p-4 bg-neo-gray/50 border-t-2 border-neo-black shrink-0">
        <p className="text-[10px] font-black text-gray-500">APKT MONITORING · PLN</p>
      </div>
    </div>
  )
}
