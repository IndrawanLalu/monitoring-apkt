import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { PasswordForm } from './password-form'
import { RekapClient, type RekapData, type UlpSummary, type ReguSummary } from './rekap-client'
import type { StatusLaporan } from '@/types'

export const dynamic = 'force-dynamic'

function isShiftActive(jamMulai: string, jamSelesai: string, nowM: number): boolean {
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export default async function RekapLaporanPage() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('rekap_auth')?.value

  if (auth !== 'authenticated') {
    return <PasswordForm />
  }

  const supabase = createAdminClient()

  // Ambil tanggal hari ini dalam zona waktu WITA (UTC+8)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayStr = now.toISOString().split('T')[0]
  const nowM = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startOfDay = `${todayStr}T00:00:00+08:00`
  const endOfDay = `${todayStr}T23:59:59+08:00`

  // Fetch data dasar
  const [
    { data: ulps },
    { data: regus },
    { data: pikets },
    { data: laporanList }
  ] = await Promise.all([
    supabase.from('ulp').select('id, nama').order('nama'),
    supabase.from('regu').select('id, ulp_id, nama').order('nama'),
    supabase.from('piket').select('id, ulp_id, shift_type(jam_mulai, jam_selesai)').eq('tanggal', todayStr),
    supabase.from('laporan').select('id, ulp_id, regu_id, status, tanggal_callback, status_callback').gte('created_at', startOfDay).lte('created_at', endOfDay)
  ])

  // Cari piket yang shift-nya sedang aktif sekarang
  const activePikets = (pikets ?? []).filter((p) => {
    const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
    if (!st) return false
    return isShiftActive(st.jam_mulai, st.jam_selesai, nowM)
  })

  // Ambil piket_petugas secara terpisah menggunakan IN clause untuk menghindari limit 1000 baris
  // HANYA ambil petugas dari piket yang sedang aktif saat ini
  const piketIds = activePikets.map(p => p.id)
  let piketPetugas: any[] = []
  
  if (piketIds.length > 0) {
    const { data } = await supabase.from('piket_petugas').select('piket_id, regu_id, petugas_apkt(nama)').in('piket_id', piketIds)
    piketPetugas = data || []
  }

  // Mapping Piket ke Petugas
  // Untuk setiap regu, cari petugas yang bertugas hari ini
  const petugasByRegu: Record<string, string[]> = {} // regu_id -> array of nama petugas
  
  if (piketPetugas.length > 0) {
    piketPetugas.forEach(pp => {
      if (pp.petugas_apkt) {
        if (!petugasByRegu[pp.regu_id]) petugasByRegu[pp.regu_id] = []
        // TypeScript safe cast because we selected petugas_apkt(nama)
        const pNama = (pp.petugas_apkt as unknown as { nama: string }).nama
        if (pNama) petugasByRegu[pp.regu_id].push(pNama)
      }
    })
  }

  // Agregasi Laporan
  const emptyStats = () => ({ lapor: 0, ditangani: 0, nyala_sementara: 0, selesai: 0 })
  
  const globalStats = emptyStats()
  let globalTotal = 0
  
  let totalCallback = 0
  const callbackStatusCount: Record<string, number> = {}

  const laporanByUlpAndRegu: Record<string, Record<string, Record<StatusLaporan, number>>> = {}

  if (laporanList) {
    laporanList.forEach(l => {
      // Hitung callback
      if (l.tanggal_callback) {
        totalCallback++
        const cbStatus = l.status_callback || 'Lainnya'
        callbackStatusCount[cbStatus] = (callbackStatusCount[cbStatus] || 0) + 1
      }

      // Hitung gangguan (hanya yang ada regu_id)
      if (l.regu_id) {
        const status = l.status as StatusLaporan
        const ulpId = l.ulp_id
        const reguId = l.regu_id

        globalStats[status]++
        globalTotal++

        if (!laporanByUlpAndRegu[ulpId]) laporanByUlpAndRegu[ulpId] = {}
        if (!laporanByUlpAndRegu[ulpId][reguId]) laporanByUlpAndRegu[ulpId][reguId] = emptyStats()
        
        laporanByUlpAndRegu[ulpId][reguId][status]++
      }
    })
  }

  // Build Hierarki
  const rekapData: RekapData = {
    total: globalStats,
    totalLaporan: globalTotal,
    tanggal: todayStr,
    ulps: [],
    callback: {
      total: totalCallback,
      statusCount: callbackStatusCount
    }
  }

  if (ulps && regus) {
    rekapData.ulps = ulps.map(ulp => {
      const ulpStats = emptyStats()
      let ulpTotal = 0
      
      const ulpRegus = regus.filter(r => r.ulp_id === ulp.id)
      const reguSummaries: ReguSummary[] = ulpRegus.map(regu => {
        const stats = laporanByUlpAndRegu[ulp.id]?.[regu.id] || emptyStats()
        const total = stats.lapor + stats.ditangani + stats.nyala_sementara + stats.selesai
        
        // Tambahkan ke ULP stats
        ulpStats.lapor += stats.lapor
        ulpStats.ditangani += stats.ditangani
        ulpStats.nyala_sementara += stats.nyala_sementara
        ulpStats.selesai += stats.selesai
        ulpTotal += total

        return {
          id: regu.id,
          nama: regu.nama,
          petugas: petugasByRegu[regu.id] || [],
          stats,
          total
        }
      })

      return {
        id: ulp.id,
        nama: ulp.nama,
        stats: ulpStats,
        total: ulpTotal,
        regus: reguSummaries
      }
    })
  }

  return <RekapClient data={rekapData} />
}
