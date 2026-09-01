import { createAdminClient } from '@/lib/supabase/admin'
import { PasswordForm } from './password-form'
import { rekapTerbuka } from './actions'
import { RekapClientWrapper } from './rekap-client-wrapper'
import type { RekapData, Up3Group, UlpSummary, ReguSummary, LaporanItem } from './rekap-client'
import type { StatusLaporan } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * Ambil SEMUA baris dari sebuah query. Supabase memotong di 1000 baris tanpa
 * memberi tanda apa pun, jadi query bulanan diam-diam mengecil begitu volume
 * lewat batas itu — tidak ada error, tidak ada log, hanya angka rekap yang salah.
 * Pola .range() ini sudah dipakai di app/(dashboard)/outage/page.tsx.
 */
async function ambilSemua<T>(
  buat: (dari: number, sampai: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const UKURAN = 1000
  const hasil: T[] = []
  for (let dari = 0; ; dari += UKURAN) {
    const { data } = await buat(dari, dari + UKURAN - 1)
    const batch = data ?? []
    hasil.push(...batch)
    if (batch.length < UKURAN) break
  }
  return hasil
}


function isShiftActive(jamMulai: string, jamSelesai: string, nowM: number): boolean {
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export default async function RekapLaporanPage() {

  if (!(await rekapTerbuka())) {
    return <PasswordForm />
  }

  const supabase = createAdminClient()

  // Tanggal hari ini dalam zona waktu WITA (UTC+8)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayStr = now.toISOString().split('T')[0]
  const nowM = now.getUTCHours() * 60 + now.getUTCMinutes()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const startOfDay   = `${todayStr}T00:00:00+08:00`
  const endOfDay     = `${todayStr}T23:59:59+08:00`
  const startOfMonth = `${year}-${month}-01T00:00:00+08:00`

  // Query paralel: ulp dasar (id, nama) selalu aman; up3 dan ulp.up3_id opsional (perlu migration)
  const [
    { data: ulpsBase },
    { data: regus },
    { data: pikets },
    { data: laporanAktif },
    { data: laporanSelesai },
    { data: callbackHariIni },
    { data: callbackBulanIni },
    { data: surveyHariIni },
    { data: surveyBulanIni },
    // Opsional — null jika migration belum dijalankan
    { data: up3List },
    { data: ulpUp3Rows },
  ] = await Promise.all([
    supabase.from('ulp').select('id, nama').order('nama'),
    supabase.from('regu').select('id, ulp_id, nama').order('nama'),
    supabase.from('piket')
      .select('id, ulp_id, shift_type(jam_mulai, jam_selesai)')
      .eq('tanggal', todayStr),
    ambilSemua((d, s) => supabase.from('laporan')
      .select('id, ulp_id, regu_id, status, nomor_tiket, nama_pelanggan, keterangan')
      .not('status', 'eq', 'selesai')
      .range(d, s)).then((data) => ({ data })),
    supabase.from('laporan')
      .select('id, ulp_id, regu_id, status, created_at')
      .eq('status', 'selesai')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    ambilSemua((d, s) => supabase.from('laporan')
      .select('id, ulp_id, status_callback')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .not('tanggal_callback', 'is', null)
      .range(d, s)).then((data) => ({ data })),
    ambilSemua((d, s) => supabase.from('laporan')
      .select('id, ulp_id, status_callback')
      .gte('created_at', startOfMonth)
      .not('tanggal_callback', 'is', null)
      .range(d, s)).then((data) => ({ data })),
    supabase.from('survey_laporan')
      .select('laporan_id, submitted_at, laporan:laporan_id(ulp_id)')
      .gte('submitted_at', startOfDay)
      .lte('submitted_at', endOfDay),
    ambilSemua((d, s) => supabase.from('survey_laporan')
      .select('laporan_id, submitted_at, laporan:laporan_id(ulp_id)')
      .gte('submitted_at', startOfMonth)
      .range(d, s)).then((data) => ({ data })),
    // Opsional — tabel up3 mungkin belum ada
    supabase.from('up3').select('id, nama').order('nama'),
    // Opsional — kolom up3_id di ulp mungkin belum ada
    supabase.from('ulp').select('id, up3_id'),
  ])

  // Cari piket aktif
  const activePikets = (pikets ?? []).filter((p) => {
    const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
    if (!st) return false
    return isShiftActive(st.jam_mulai, st.jam_selesai, nowM)
  })

  const piketIds = activePikets.map(p => p.id)
  let piketPetugas: any[] = []
  if (piketIds.length > 0) {
    const { data } = await supabase
      .from('piket_petugas')
      .select('piket_id, regu_id, petugas_apkt(nama)')
      .in('piket_id', piketIds)
    piketPetugas = data || []
  }

  const petugasByRegu: Record<string, string[]> = {}
  piketPetugas.forEach(pp => {
    if (pp.petugas_apkt) {
      if (!petugasByRegu[pp.regu_id]) petugasByRegu[pp.regu_id] = []
      const pNama = (pp.petugas_apkt as unknown as { nama: string }).nama
      if (pNama) petugasByRegu[pp.regu_id].push(pNama)
    }
  })

  // Agregasi laporan
  const emptyStats = () => ({ lapor: 0, penugasan_regu: 0, ditangani: 0, nyala_sementara: 0, selesai: 0 })
  const laporanList = [...(laporanAktif ?? []), ...(laporanSelesai ?? [])]
  const laporanByUlpAndRegu: Record<string, Record<string, Record<StatusLaporan, number>>> = {}
  const laporanAktifByRegu: Record<string, LaporanItem[]> = {}

  laporanList.forEach(l => {
    if (!l.regu_id) return
    const status = l.status as StatusLaporan
    if (!laporanByUlpAndRegu[l.ulp_id]) laporanByUlpAndRegu[l.ulp_id] = {}
    if (!laporanByUlpAndRegu[l.ulp_id][l.regu_id]) laporanByUlpAndRegu[l.ulp_id][l.regu_id] = emptyStats()
    laporanByUlpAndRegu[l.ulp_id][l.regu_id][status]++
  })

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

  // Map laporan_id → ulp_id (untuk survey)
  const laporanUlpMap: Record<string, string> = {}
  laporanList.forEach(l => { laporanUlpMap[l.id] = l.ulp_id })

  // Build ULP summary
  const buildUlpSummary = (ulp: { id: string; nama: string }): UlpSummary => {
    const ulpStats = emptyStats()
    let ulpTotal = 0
    const ulpRegus = (regus ?? []).filter(r => r.ulp_id === ulp.id)
    const reguSummaries: ReguSummary[] = ulpRegus.map(regu => {
      const stats = laporanByUlpAndRegu[ulp.id]?.[regu.id] || emptyStats()
      const total = stats.lapor + stats.penugasan_regu + stats.ditangani + stats.nyala_sementara + stats.selesai
      ulpStats.lapor            += stats.lapor
      ulpStats.penugasan_regu   += stats.penugasan_regu
      ulpStats.ditangani        += stats.ditangani
      ulpStats.nyala_sementara  += stats.nyala_sementara
      ulpStats.selesai          += stats.selesai
      ulpTotal += total
      return { id: regu.id, nama: regu.nama, petugas: petugasByRegu[regu.id] || [], stats, total, laporanAktif: laporanAktifByRegu[regu.id] || [] }
    })
    return { id: ulp.id, nama: ulp.nama, stats: ulpStats, total: ulpTotal, regus: reguSummaries }
  }

  // --- Cek apakah UP3 migration sudah dijalankan ---
  const hasMigration = (up3List !== null) && (ulpUp3Rows !== null)

  let up3Groups: Up3Group[] = []
  const globalStats = emptyStats()
  let globalTotal = 0

  if (hasMigration && (up3List ?? []).length > 0) {
    // Map ulp_id → up3_id (dari kolom up3_id di tabel ulp)
    const ulpUp3Map: Record<string, string> = {}
    ;(ulpUp3Rows ?? []).forEach((u: any) => { if (u.up3_id) ulpUp3Map[u.id] = u.up3_id })

    // Hitung callback & survey per UP3
    const callbackHariIniByUp3: Record<string, number> = {}
    const callbackBulanIniByUp3: Record<string, number> = {}
    const surveyHariIniByUp3: Record<string, number> = {}
    const surveyBulanIniByUp3: Record<string, number> = {}
    const callbackStatusHariIniByUp3: Record<string, Record<string, number>> = {}

    ;(callbackHariIni ?? []).forEach(l => {
      const up3Id = ulpUp3Map[l.ulp_id]
      if (!up3Id) return
      callbackHariIniByUp3[up3Id] = (callbackHariIniByUp3[up3Id] || 0) + 1
      if (!callbackStatusHariIniByUp3[up3Id]) callbackStatusHariIniByUp3[up3Id] = {}
      const st = l.status_callback || 'Lainnya'
      callbackStatusHariIniByUp3[up3Id][st] = (callbackStatusHariIniByUp3[up3Id][st] || 0) + 1
    })
    ;(callbackBulanIni ?? []).forEach(l => {
      const up3Id = ulpUp3Map[l.ulp_id]
      if (!up3Id) return
      callbackBulanIniByUp3[up3Id] = (callbackBulanIniByUp3[up3Id] || 0) + 1
    })
    ;(surveyHariIni ?? []).forEach(s => {
      const ulpId = (s.laporan as any)?.ulp_id ?? laporanUlpMap[s.laporan_id]
      const up3Id = ulpId ? ulpUp3Map[ulpId] : undefined
      if (!up3Id) return
      surveyHariIniByUp3[up3Id] = (surveyHariIniByUp3[up3Id] || 0) + 1
    })
    ;(surveyBulanIni ?? []).forEach(s => {
      const ulpId = (s.laporan as any)?.ulp_id ?? laporanUlpMap[s.laporan_id]
      const up3Id = ulpId ? ulpUp3Map[ulpId] : undefined
      if (!up3Id) return
      surveyBulanIniByUp3[up3Id] = (surveyBulanIniByUp3[up3Id] || 0) + 1
    })

    for (const up3 of (up3List ?? [])) {
      const ulpsInUp3 = (ulpsBase ?? []).filter(u => ulpUp3Map[u.id] === up3.id)
      const ulpSummaries = ulpsInUp3.map(u => buildUlpSummary(u))

      const groupStats = emptyStats()
      let groupTotal = 0
      ulpSummaries.forEach(u => {
        groupStats.lapor           += u.stats.lapor
        groupStats.penugasan_regu  += u.stats.penugasan_regu
        groupStats.ditangani       += u.stats.ditangani
        groupStats.nyala_sementara += u.stats.nyala_sementara
        groupStats.selesai         += u.stats.selesai
        groupTotal += u.total
      })
      globalStats.lapor           += groupStats.lapor
      globalStats.penugasan_regu  += groupStats.penugasan_regu
      globalStats.ditangani       += groupStats.ditangani
      globalStats.nyala_sementara += groupStats.nyala_sementara
      globalStats.selesai         += groupStats.selesai
      globalTotal += groupTotal

      up3Groups.push({
        up3Id: up3.id,
        up3Nama: up3.nama,
        ulps: ulpSummaries,
        totalLaporan: groupTotal,
        totalStats: groupStats,
        callback: {
          hariIni: callbackHariIniByUp3[up3.id] || 0,
          bulanIni: callbackBulanIniByUp3[up3.id] || 0,
          statusCountHariIni: callbackStatusHariIniByUp3[up3.id] || {},
        },
        survey: {
          hariIni: surveyHariIniByUp3[up3.id] || 0,
          bulanIni: surveyBulanIniByUp3[up3.id] || 0,
        },
      })
    }

    // ULP tanpa UP3 (up3_id belum di-set) — fallback group
    const ulpsWithoutUp3 = (ulpsBase ?? []).filter(u => !ulpUp3Map[u.id])
    if (ulpsWithoutUp3.length > 0) {
      const fallbackUlps = ulpsWithoutUp3.map(u => buildUlpSummary(u))
      const fallbackStats = emptyStats()
      let fallbackTotal = 0
      fallbackUlps.forEach(u => {
        fallbackStats.lapor           += u.stats.lapor
        fallbackStats.penugasan_regu  += u.stats.penugasan_regu
        fallbackStats.ditangani       += u.stats.ditangani
        fallbackStats.nyala_sementara += u.stats.nyala_sementara
        fallbackStats.selesai         += u.stats.selesai
        fallbackTotal += u.total
      })
      globalStats.lapor           += fallbackStats.lapor
      globalStats.penugasan_regu  += fallbackStats.penugasan_regu
      globalStats.ditangani       += fallbackStats.ditangani
      globalStats.nyala_sementara += fallbackStats.nyala_sementara
      globalStats.selesai         += fallbackStats.selesai
      globalTotal += fallbackTotal

      up3Groups.push({
        up3Id: '__no_up3__',
        up3Nama: 'Lainnya',
        ulps: fallbackUlps,
        totalLaporan: fallbackTotal,
        totalStats: fallbackStats,
        callback: { hariIni: 0, bulanIni: 0, statusCountHariIni: {} },
        survey: { hariIni: 0, bulanIni: 0 },
      })
    }
  } else {
    // Fallback: migration belum dijalankan — tampilkan semua ULP dalam 1 grup tanpa label UP3
    const hariIniCallback = (callbackHariIni ?? []).length
    const bulanIniCallback = (callbackBulanIni ?? []).length
    const callbackStatusHariIni: Record<string, number> = {}
    ;(callbackHariIni ?? []).forEach(l => {
      const st = l.status_callback || 'Lainnya'
      callbackStatusHariIni[st] = (callbackStatusHariIni[st] || 0) + 1
    })

    const allUlps = (ulpsBase ?? []).map(u => buildUlpSummary(u))
    allUlps.forEach(u => {
      globalStats.lapor           += u.stats.lapor
      globalStats.penugasan_regu  += u.stats.penugasan_regu
      globalStats.ditangani       += u.stats.ditangani
      globalStats.nyala_sementara += u.stats.nyala_sementara
      globalStats.selesai         += u.stats.selesai
      globalTotal += u.total
    })

    up3Groups = [{
      up3Id: '__all__',
      up3Nama: '',
      ulps: allUlps,
      totalLaporan: globalTotal,
      totalStats: globalStats,
      callback: {
        hariIni: hariIniCallback,
        bulanIni: bulanIniCallback,
        statusCountHariIni: callbackStatusHariIni,
      },
      survey: {
        hariIni: (surveyHariIni ?? []).length,
        bulanIni: (surveyBulanIni ?? []).length,
      },
    }]
  }

  const rekapData: RekapData = {
    tanggal: todayStr,
    totalLaporan: globalTotal,
    totalStats: globalStats,
    up3Groups,
  }

  return <RekapClientWrapper data={rekapData} />
}
