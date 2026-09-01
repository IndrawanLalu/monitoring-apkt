import { createAdminClient } from '@/lib/supabase/admin'
import { PasswordForm } from '../rekap-laporan/password-form'
import { rekapTerbuka } from '../rekap-laporan/actions'
import { RekapSurveyClientWrapper } from './rekap-survey-client-wrapper'
import type { RekapSurveyData, SurveyItem } from './rekap-survey-client'

export const dynamic = 'force-dynamic'

export default async function RekapSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; ulp_id?: string }>
}) {
  if (!(await rekapTerbuka())) {
    return <PasswordForm />
  }

  const supabase = createAdminClient()

  const sp = await searchParams
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000) // WITA (UTC+8)
  const year  = parseInt(sp.year ?? String(now.getUTCFullYear()))
  const month = sp.month !== undefined ? parseInt(sp.month) : (now.getUTCMonth() + 1)
  // month = 0 berarti semua bulan dalam tahun tersebut

  // Rentang tanggal berdasar submitted_at (kapan survey diisi pelanggan) —
  // konsisten dengan angka "Survey Bulan Ini" di /rekap-laporan.
  const startDate = month === 0
    ? `${year}-01-01T00:00:00+08:00`
    : `${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`
  const lastDay = month === 0 ? 0 : new Date(year, month, 0).getDate()
  const endDate = month === 0
    ? `${year}-12-31T23:59:59+08:00`
    : `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59+08:00`

  // ULP untuk dropdown filter + peta nama
  const { data: ulpsRaw } = await supabase.from('ulp').select('id, nama').order('nama')
  const ulps = (ulpsRaw ?? []).map(u => ({ id: u.id as string, nama: u.nama as string }))
  const ulpMap = Object.fromEntries(ulps.map(u => [u.id, u.nama]))
  const selectedUlpId = sp.ulp_id && ulps.some(u => u.id === sp.ulp_id) ? sp.ulp_id : null

  // Survey-driven: inner join ke laporan untuk ambil detail tiket sekaligus.
  // Jumlah survey per periode kecil → aman dari cap 1000 baris.
  type LaporanEmbed = {
    nomor_tiket: string; lokasi: string; ulp_id: string; regu_id: string
    piket_id: string; resolved_piket_id: string | null; resolved_petugas_names: string[] | null
  }
  type SurveyRow = {
    laporan_id: string; kepuasan_keseluruhan: string; submitted_at: string
    nama_pelanggan: string; alamat: string
    kondisi_setelah: string; kualitas_pelayanan: string; kecepatan_respon: string
    ada_pungli: string; ada_tips: string; ada_3s: string; ada_identitas: string
    ada_apd: string; ada_hal_tidak_senang: string; pesan_saran: string | null
    laporan: LaporanEmbed | null
  }
  let query = supabase
    .from('survey_laporan')
    .select('laporan_id, kepuasan_keseluruhan, submitted_at, nama_pelanggan, alamat, kondisi_setelah, kualitas_pelayanan, kecepatan_respon, ada_pungli, ada_tips, ada_3s, ada_identitas, ada_apd, ada_hal_tidak_senang, pesan_saran, laporan:laporan_id!inner(nomor_tiket, lokasi, ulp_id, regu_id, piket_id, resolved_piket_id, resolved_petugas_names)')
    .gte('submitted_at', startDate)
    .lte('submitted_at', endDate)
    .order('submitted_at', { ascending: false })
  if (selectedUlpId) query = query.eq('laporan.ulp_id', selectedUlpId)
  const { data: surveysRaw } = await query
  const surveys = (surveysRaw ?? []) as unknown as SurveyRow[]

  // ─── Resolusi nama petugas (snapshot → piket_petugas → petugas regu) ─────
  const piketIds = [...new Set(surveys
    .map(s => s.laporan?.resolved_piket_id ?? s.laporan?.piket_id)
    .filter(Boolean) as string[])]
  const reguIds = [...new Set(surveys.map(s => s.laporan?.regu_id).filter(Boolean) as string[])]

  const ppMap: Record<string, string[]> = {} // `${piket_id}__${regu_id}` → nama[]
  if (piketIds.length > 0) {
    const { data } = await supabase
      .from('piket_petugas')
      .select('piket_id, regu_id, petugas:petugas_apkt(nama)')
      .in('piket_id', piketIds)
    ;(data ?? []).forEach(d => {
      const nama = (d.petugas as unknown as { nama: string } | null)?.nama
      if (!nama) return
      const key = `${d.piket_id}__${d.regu_id}`
      ;(ppMap[key] ??= []).push(nama)
    })
  }

  const reguPetugasMap: Record<string, string[]> = {}
  if (reguIds.length > 0) {
    const { data } = await supabase
      .from('petugas_apkt')
      .select('regu_id, nama')
      .in('regu_id', reguIds)
    ;(data ?? []).forEach(p => {
      const rid = p.regu_id as string
      ;(reguPetugasMap[rid] ??= []).push(p.nama as string)
    })
  }

  const resolvePetugas = (l: LaporanEmbed): string[] => {
    if (l.resolved_petugas_names && l.resolved_petugas_names.length > 0) return l.resolved_petugas_names
    if (l.regu_id) {
      const piket = l.resolved_piket_id ?? l.piket_id
      if (piket) {
        const fromPiket = ppMap[`${piket}__${l.regu_id}`]
        if (fromPiket && fromPiket.length > 0) return fromPiket
      }
      return reguPetugasMap[l.regu_id] ?? []
    }
    return []
  }

  // ─── Bentuk surveyList + distribusi rating ───────────────────────────────
  const ratingCounts = { sangat_puas: 0, puas: 0, biasa: 0, tidak_puas: 0, sangat_tidak_puas: 0 }
  const surveyList: SurveyItem[] = []
  surveys.forEach(s => {
    const l = s.laporan
    if (!l) return
    if (s.kepuasan_keseluruhan in ratingCounts) {
      ratingCounts[s.kepuasan_keseluruhan as keyof typeof ratingCounts]++
    }
    surveyList.push({
      nomorTiket:  l.nomor_tiket,
      lokasi:      l.lokasi,
      ulpNama:     ulpMap[l.ulp_id] ?? '—',
      petugas:     resolvePetugas(l),
      kepuasan:    s.kepuasan_keseluruhan,
      submittedAt: s.submitted_at,
      namaPelanggan:     s.nama_pelanggan,
      alamat:            s.alamat,
      kondisiSetelah:    s.kondisi_setelah,
      kualitasPelayanan: s.kualitas_pelayanan,
      kecepatanRespon:   s.kecepatan_respon,
      adaPungli:         s.ada_pungli,
      adaTips:           s.ada_tips,
      ada3s:             s.ada_3s,
      adaIdentitas:      s.ada_identitas,
      adaApd:            s.ada_apd,
      adaHalTidakSenang: s.ada_hal_tidak_senang,
      pesanSaran:        s.pesan_saran,
    })
  })

  const data: RekapSurveyData = {
    year, month, ulps, selectedUlpId, surveyList, ratingCounts,
  }

  return <RekapSurveyClientWrapper data={data} />
}
