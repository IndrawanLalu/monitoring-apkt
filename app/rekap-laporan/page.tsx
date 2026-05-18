import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { PasswordForm } from './password-form'
import { RekapClient, type RekapData, type UlpSummary, type ReguSummary, type LaporanItem } from './rekap-client'
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

  // Tanggal hari ini dalam zona waktu WITA (UTC+8)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayStr = now.toISOString().split('T')[0]
  const nowM = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startOfDay = `${todayStr}T00:00:00+08:00`
  const endOfDay   = `${todayStr}T23:59:59+08:00`

  // Fetch data master + piket + laporan secara paralel
  // Laporan NON-selesai: dari semua tanggal (gangguan yang belum selesai)
  // Laporan selesai: hanya hari ini
  const [
    { data: ulps },
    { data: regus },
    { data: pikets },
    { data: laporanAktif },
    { data: laporanSelesai },
    { data: laporanCallback },
  ] = await Promise.all([
    supabase.from('ulp').select('id, nama').order('nama'),
    supabase.from('regu').select('id, ulp_id, nama').order('nama'),
    supabase.from('piket')
      .select('id, ulp_id, shift_type(jam_mulai, jam_selesai)')
      .eq('tanggal', todayStr),
    // Gangguan yang belum selesai — semua waktu
    supabase.from('laporan')
      .select('id, ulp_id, regu_id, status, nomor_tiket, nama_pelanggan, keterangan')
      .not('status', 'eq', 'selesai'),
    // Gangguan selesai — hanya hari ini
    supabase.from('laporan')
      .select('id, ulp_id, regu_id, status, created_at')
      .eq('status', 'selesai')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    // Callback — hanya hari ini
    supabase.from('laporan')
      .select('id, tanggal_callback, status_callback')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .not('tanggal_callback', 'is', null),
  ])

  // Gabungkan laporan aktif + selesai hari ini
  const laporanList = [...(laporanAktif ?? []), ...(laporanSelesai ?? [])]

  // Cari piket yang shift-nya sedang aktif sekarang
  const activePikets = (pikets ?? []).filter((p) => {
    const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
    if (!st) return false
    return isShiftActive(st.jam_mulai, st.jam_selesai, nowM)
  })

  // Ambil petugas dari piket aktif
  const piketIds = activePikets.map(p => p.id)
  let piketPetugas: any[] = []
  if (piketIds.length > 0) {
    const { data } = await supabase
      .from('piket_petugas')
      .select('piket_id, regu_id, petugas_apkt(nama)')
      .in('piket_id', piketIds)
    piketPetugas = data || []
  }

  // Mapping regu -> petugas piket aktif
  const petugasByRegu: Record<string, string[]> = {}
  piketPetugas.forEach(pp => {
    if (pp.petugas_apkt) {
      if (!petugasByRegu[pp.regu_id]) petugasByRegu[pp.regu_id] = []
      const pNama = (pp.petugas_apkt as unknown as { nama: string }).nama
      if (pNama) petugasByRegu[pp.regu_id].push(pNama)
    }
  })

  // Agregasi laporan
  const emptyStats = () => ({ lapor: 0, ditangani: 0, nyala_sementara: 0, selesai: 0 })
  const globalStats = emptyStats()
  let globalTotal = 0
  const laporanByUlpAndRegu: Record<string, Record<string, Record<StatusLaporan, number>>> = {}
  const laporanAktifByRegu: Record<string, LaporanItem[]> = {}

  laporanList.forEach(l => {
    if (!l.regu_id) return
    const status = l.status as StatusLaporan
    globalStats[status]++
    globalTotal++
    if (!laporanByUlpAndRegu[l.ulp_id]) laporanByUlpAndRegu[l.ulp_id] = {}
    if (!laporanByUlpAndRegu[l.ulp_id][l.regu_id]) laporanByUlpAndRegu[l.ulp_id][l.regu_id] = emptyStats()
    laporanByUlpAndRegu[l.ulp_id][l.regu_id][status]++
  })

  // Kumpulkan laporan belum selesai per regu (untuk ditampilkan detail)
  ;(laporanAktif ?? []).forEach(l => {
    if (!l.regu_id) return
    if (!laporanAktifByRegu[l.regu_id]) laporanAktifByRegu[l.regu_id] = []
    laporanAktifByRegu[l.regu_id].push({
      id: l.id,
      nomor_tiket: l.nomor_tiket,
      nama_pelanggan: l.nama_pelanggan,
      keterangan: l.keterangan ?? null,
      status: l.status as StatusLaporan,
    })
  })

  // Agregasi callback
  let totalCallback = 0
  const callbackStatusCount: Record<string, number> = {}
  ;(laporanCallback ?? []).forEach(l => {
    totalCallback++
    const cbStatus = l.status_callback || 'Lainnya'
    callbackStatusCount[cbStatus] = (callbackStatusCount[cbStatus] || 0) + 1
  })

  // Build RekapData
  const rekapData: RekapData = {
    total: globalStats,
    totalLaporan: globalTotal,
    tanggal: todayStr,
    ulps: [],
    callback: { total: totalCallback, statusCount: callbackStatusCount },
  }

  if (ulps && regus) {
    rekapData.ulps = ulps.map(ulp => {
      const ulpStats = emptyStats()
      let ulpTotal = 0
      const ulpRegus = regus.filter(r => r.ulp_id === ulp.id)
      const reguSummaries: ReguSummary[] = ulpRegus.map(regu => {
        const stats = laporanByUlpAndRegu[ulp.id]?.[regu.id] || emptyStats()
        const total = stats.lapor + stats.ditangani + stats.nyala_sementara + stats.selesai
        ulpStats.lapor         += stats.lapor
        ulpStats.ditangani     += stats.ditangani
        ulpStats.nyala_sementara += stats.nyala_sementara
        ulpStats.selesai       += stats.selesai
        ulpTotal += total
        return { id: regu.id, nama: regu.nama, petugas: petugasByRegu[regu.id] || [], stats, total, laporanAktif: laporanAktifByRegu[regu.id] || [] }
      })
      return { id: ulp.id, nama: ulp.nama, stats: ulpStats, total: ulpTotal, regus: reguSummaries }
    })
  }

  return <RekapClient data={rekapData} />
}
