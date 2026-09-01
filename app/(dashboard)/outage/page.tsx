import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OutageClient, type OutageData } from './outage-client'

export const dynamic = 'force-dynamic'

export default async function OutagePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; ulp_id?: string }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login?err=no-profile')

  const sp = await searchParams
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const year  = parseInt(sp.year  ?? String(now.getUTCFullYear()))
  const month = sp.month !== undefined ? parseInt(sp.month) : (now.getUTCMonth() + 1)
  // month = 0 berarti semua bulan dalam tahun tersebut

  const admin = createAdminClient()
  const ulpIds = profile.ulps.map(u => u.id)
  if (ulpIds.length === 0) redirect('/settings')
  const selectedUlpId = sp.ulp_id && ulpIds.includes(sp.ulp_id) ? sp.ulp_id : null
  const filteredUlpIds = selectedUlpId ? [selectedUlpId] : ulpIds

  // Date range
  const startDate = month === 0
    ? `${year}-01-01T00:00:00+08:00`
    : `${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`
  const lastDay = month === 0 ? 0 : new Date(year, month, 0).getDate()
  const endDate = month === 0
    ? `${year}-12-31T23:59:59+08:00`
    : `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59+08:00`

  // Fetch laporan selesai in period.
  // Supabase membatasi 1000 baris/req → paginasi via .range() agar semua laporan terambil.
  // (Bulan ramai bisa >3000 laporan; tanpa paginasi statistik, kalender & survey ikut terpotong)
  type LaporanRow = {
    id: string; nomor_tiket: string; ulp_id: string; regu_id: string; piket_id: string
    resolved_piket_id: string | null; resolved_petugas_names: string[] | null
    lokasi: string; resolved_at: string; created_at: string
  }
  const laporan: LaporanRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('laporan')
      .select('id, nomor_tiket, ulp_id, regu_id, piket_id, resolved_piket_id, resolved_petugas_names, lokasi, resolved_at, created_at')
      .eq('status', 'selesai')
      .in('ulp_id', filteredUlpIds)
      .gte('resolved_at', startDate)
      .lte('resolved_at', endDate)
      .order('resolved_at', { ascending: false })
      .range(from, from + 999)
    if (error || !data) break
    laporan.push(...(data as unknown as LaporanRow[]))
    if (data.length < 1000) break
  }
  // Gunakan resolved_piket_id (piket aktif saat selesai), fallback ke piket_id untuk data lama
  const piketIds = [...new Set(laporan.map(l => (l.resolved_piket_id ?? l.piket_id) as string).filter(Boolean))]

  // Fetch piket_petugas for those pikets — chunk .in() agar URL tak melampaui batas server
  const ppData: { piket_id: string; regu_id: string; petugas: { id: string; nama: string } | null }[] = []
  for (let i = 0; i < piketIds.length; i += 150) {
    const { data } = await admin
      .from('piket_petugas')
      .select('piket_id, regu_id, petugas:petugas_apkt(id, nama)')
      .in('piket_id', piketIds.slice(i, i + 150))
    ;(data ?? []).forEach(d => {
      ppData.push({
        piket_id: d.piket_id as string,
        regu_id: d.regu_id as string,
        petugas: d.petugas as unknown as { id: string; nama: string } | null,
      })
    })
  }

  // Fetch surveys via inner join ke laporan (filter status/ulp/periode di sisi DB).
  // Hindari .in('laporan_id', ribuan id) yang bikin URL kepanjangan → Bad Request → survey kosong.
  type SurveyRow = {
    laporan_id: string; kepuasan_keseluruhan: string; submitted_at: string
    nama_pelanggan: string; alamat: string
    kondisi_setelah: string; kualitas_pelayanan: string; kecepatan_respon: string
    ada_pungli: string; ada_tips: string; ada_3s: string; ada_identitas: string
    ada_apd: string; ada_hal_tidak_senang: string; pesan_saran: string | null
  }
  const surveysRaw: SurveyRow[] = []
  {
    const { data } = await admin
      .from('survey_laporan')
      .select('laporan_id, kepuasan_keseluruhan, submitted_at, nama_pelanggan, alamat, kondisi_setelah, kualitas_pelayanan, kecepatan_respon, ada_pungli, ada_tips, ada_3s, ada_identitas, ada_apd, ada_hal_tidak_senang, pesan_saran, laporan:laporan_id!inner(status, ulp_id, resolved_at)')
      .eq('laporan.status', 'selesai')
      .in('laporan.ulp_id', filteredUlpIds)
      .gte('laporan.resolved_at', startDate)
      .lte('laporan.resolved_at', endDate)
      .order('submitted_at', { ascending: false })
    ;(data ?? []).forEach(d => surveysRaw.push(d as unknown as SurveyRow))
  }

  // Fetch ULP info
  const { data: ulpsRaw } = await admin.from('ulp').select('id, nama').in('id', ulpIds).order('nama')
  const ulpMap = Object.fromEntries((ulpsRaw ?? []).map(u => [u.id as string, u.nama as string]))

  // Build map: (piket_id + regu_id) → petugas[]
  const ppMap: Record<string, string[]> = {}
  ppData.forEach(pp => {
    if (!pp.petugas) return
    const key = `${pp.piket_id}__${pp.regu_id}`
    if (!ppMap[key]) ppMap[key] = []
    ppMap[key].push(pp.petugas.nama)
  })

  // Fallback map: regu_id → petugas[] (dipakai jika piket_petugas tidak punya data)
  const reguIds = [...new Set(laporan.map(l => l.regu_id as string).filter(Boolean))]
  const reguPetugasMap: Record<string, string[]> = {}
  if (reguIds.length > 0) {
    const { data: reguPetugasRaw } = await admin
      .from('petugas_apkt')
      .select('regu_id, nama')
      .in('regu_id', reguIds)
    ;(reguPetugasRaw ?? []).forEach(p => {
      const rid = p.regu_id as string
      if (!reguPetugasMap[rid]) reguPetugasMap[rid] = []
      reguPetugasMap[rid].push(p.nama as string)
    })
  }

  // For each laporan, get petugas names.
  // Primary: resolved_petugas_names snapshot (data baru, permanen).
  // Fallback 1: resolved_piket_id + regu_id (data lama sebelum fitur snapshot).
  // Fallback 2: piket_id + regu_id.
  // Fallback 3: semua petugas di regu.
  const getLaporanPetugas = (l: typeof laporan[0]): string[] => {
    const snap = l.resolved_petugas_names as string[] | null
    if (snap && snap.length > 0) return snap
    if (l.regu_id) {
      const resolvedPiketId = l.resolved_piket_id ?? l.piket_id
      if (resolvedPiketId) {
        const fromPiket = ppMap[`${resolvedPiketId}__${l.regu_id}`]
        if (fromPiket && fromPiket.length > 0) return fromPiket
      }
      return reguPetugasMap[l.regu_id as string] ?? []
    }
    return []
  }

  // ─── Stats: petugas selesai count ────────────────────────────
  const petugasSelesaiMap: Record<string, { nama: string; ulpNama: string; count: number }> = {}
  laporan.forEach(l => {
    const petugas = getLaporanPetugas(l)
    const ulpNama = ulpMap[l.ulp_id as string] ?? '—'
    petugas.forEach(nama => {
      const key = `${nama}__${l.ulp_id}`
      if (!petugasSelesaiMap[key]) petugasSelesaiMap[key] = { nama, ulpNama, count: 0 }
      petugasSelesaiMap[key].count++
    })
  })
  const petugasSelesaiList = Object.values(petugasSelesaiMap)
    .sort((a, b) => b.count - a.count)

  // ─── Stats: rating per petugas (semua kategori) ──────────────
  const surveyByLaporan = Object.fromEntries(surveysRaw.map(s => [s.laporan_id, s.kepuasan_keseluruhan]))
  const petugasPuasMap: Record<string, {
    nama: string; ulpNama: string;
    sangat_puas: number; puas: number; biasa: number; tidak_puas: number; sangat_tidak_puas: number;
    total: number
  }> = {}
  laporan.forEach(l => {
    const rating = surveyByLaporan[l.id as string]
    if (!rating) return
    const petugas = getLaporanPetugas(l)
    const ulpNama = ulpMap[l.ulp_id as string] ?? '—'
    petugas.forEach(nama => {
      const key = `${nama}__${l.ulp_id}`
      if (!petugasPuasMap[key]) petugasPuasMap[key] = { nama, ulpNama, sangat_puas: 0, puas: 0, biasa: 0, tidak_puas: 0, sangat_tidak_puas: 0, total: 0 }
      petugasPuasMap[key].total++
      if (rating === 'sangat_puas')       petugasPuasMap[key].sangat_puas++
      else if (rating === 'puas')         petugasPuasMap[key].puas++
      else if (rating === 'biasa')        petugasPuasMap[key].biasa++
      else if (rating === 'tidak_puas')   petugasPuasMap[key].tidak_puas++
      else if (rating === 'sangat_tidak_puas') petugasPuasMap[key].sangat_tidak_puas++
    })
  })
  const petugasPuasList = Object.values(petugasPuasMap)
    .sort((a, b) => b.sangat_puas - a.sangat_puas || b.puas - a.puas || b.total - a.total)

  // ─── Survey list ─────────────────────────────────────────────
  const surveyList = surveysRaw.map(s => {
    const l = laporan.find(x => x.id === s.laporan_id)
    if (!l) return null
    return {
      nomorTiket:   l.nomor_tiket as string,
      lokasi:       l.lokasi as string,
      ulpNama:      ulpMap[l.ulp_id as string] ?? '—',
      petugas:      getLaporanPetugas(l),
      kepuasan:     s.kepuasan_keseluruhan,
      submittedAt:  s.submitted_at,
      namaPelanggan:      s.nama_pelanggan,
      alamat:             s.alamat,
      kondisiSetelah:     s.kondisi_setelah,
      kualitasPelayanan:  s.kualitas_pelayanan,
      kecepatanRespon:    s.kecepatan_respon,
      adaPungli:          s.ada_pungli,
      adaTips:            s.ada_tips,
      ada3s:              s.ada_3s,
      adaIdentitas:       s.ada_identitas,
      adaApd:             s.ada_apd,
      adaHalTidakSenang:  s.ada_hal_tidak_senang,
      pesanSaran:         s.pesan_saran,
    }
  }).filter(Boolean) as OutageData['surveyList']

  // ─── Calendar ────────────────────────────────────────────────
  const calendarDays: OutageData['calendarDays'] = []

  if (month === 0) {
    // Semua bulan: grup per bulan (1-12)
    const calMap: Record<number, Record<string, number>> = {}
    laporan.forEach(l => {
      if (!l.resolved_at) return
      const m = parseInt((l.resolved_at as string).substring(5, 7))
      const petugas = getLaporanPetugas(l)
      if (!calMap[m]) calMap[m] = {}
      petugas.forEach(nama => { calMap[m][nama] = (calMap[m][nama] ?? 0) + 1 })
    })
    for (let m = 1; m <= 12; m++) {
      const dayData = calMap[m] ?? {}
      calendarDays.push({
        tanggal: `${year}-${String(m).padStart(2, '0')}`,
        petugas: Object.entries(dayData).map(([nama, count]) => ({ nama, count })).sort((a, b) => b.count - a.count),
        total: Object.values(dayData).reduce((s, v) => s + v, 0),
      })
    }
  } else {
    // Bulan spesifik: grup per hari (1-lastDay)
    const calMap: Record<string, Record<string, number>> = {}
    laporan.forEach(l => {
      if (!l.resolved_at) return
      const tgl = (l.resolved_at as string).split('T')[0]
      const petugas = getLaporanPetugas(l)
      if (!calMap[tgl]) calMap[tgl] = {}
      petugas.forEach(nama => { calMap[tgl][nama] = (calMap[tgl][nama] ?? 0) + 1 })
    })
    for (let d = 1; d <= lastDay; d++) {
      const tgl = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayData = calMap[tgl] ?? {}
      calendarDays.push({
        tanggal: tgl,
        petugas: Object.entries(dayData).map(([nama, count]) => ({ nama, count })).sort((a, b) => b.count - a.count),
        total: Object.values(dayData).reduce((s, v) => s + v, 0),
      })
    }
  }

  const data: OutageData = {
    year, month,
    ulps: (ulpsRaw ?? []).map(u => ({ id: u.id as string, nama: u.nama as string })),
    selectedUlpId,
    totalSelesai: laporan.length,
    petugasSelesaiList,
    petugasPuasList,
    surveyList,
    calendarDays,
  }

  return <OutageClient data={data} profileRole={profile.role} />
}
