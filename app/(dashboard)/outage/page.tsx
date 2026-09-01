import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { ulpIdsTerlihat } from '@/lib/otorisasi'
import { createAdminClient } from '@/lib/supabase/admin'
import { OutageClient, type OutageData, type RekapOutage } from './outage-client'

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

  // Admin melihat seluruh ULP di UP3-nya, operator hanya ULP yang di-assign.
  const ulpIds = await ulpIdsTerlihat(profile)
  if (ulpIds.length === 0) redirect('/settings')

  const selectedUlpId = sp.ulp_id && ulpIds.includes(sp.ulp_id) ? sp.ulp_id : null
  const filteredUlpIds = selectedUlpId ? [selectedUlpId] : ulpIds

  const startDate = month === 0
    ? `${year}-01-01T00:00:00+08:00`
    : `${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`
  const lastDay = month === 0 ? 0 : new Date(year, month, 0).getDate()
  const endDate = month === 0
    ? `${year}-12-31T23:59:59+08:00`
    : `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59+08:00`

  // Seluruh agregasi dikerjakan Postgres lewat rekap_outage(). Versi sebelumnya
  // menarik SETIAP laporan selesai satu bulan ke memori Node — pada 1000
  // laporan/hari itu ~30.000 baris per pembukaan halaman — lalu menghitungnya
  // di JavaScript, ditambah query piket_petugas yang dipotong per 150 id.
  // Periode pembanding untuk delta KPI: bulan sebelumnya, atau tahun
  // sebelumnya kalau filter sedang "semua bulan".
  const sebelumnya = month === 0
    ? { mulai: `${year - 1}-01-01T00:00:00+08:00`, akhir: `${year - 1}-12-31T23:59:59+08:00` }
    : (() => {
        const y = month === 1 ? year - 1 : year
        const m = month === 1 ? 12 : month - 1
        const hariAkhir = new Date(y, m, 0).getDate()
        return {
          mulai: `${y}-${String(m).padStart(2, '0')}-01T00:00:00+08:00`,
          akhir: `${y}-${String(m).padStart(2, '0')}-${hariAkhir}T23:59:59+08:00`,
        }
      })()

  const [{ data: rekapRaw, error: rekapError }, { data: rekapSebelumRaw }, { data: surveysRaw }, { data: ulpsRaw }] = await Promise.all([
    admin.rpc('rekap_outage', {
      p_ulp_ids: filteredUlpIds,
      p_mulai: startDate,
      p_selesai: endDate,
    }),
    admin.rpc('rekap_outage', {
      p_ulp_ids: filteredUlpIds,
      p_mulai: sebelumnya.mulai,
      p_selesai: sebelumnya.akhir,
    }),
    // Daftar survey butuh baris utuh untuk modal detail, tapi jumlahnya jauh
    // lebih kecil dari jumlah laporan sehingga aman diambil apa adanya.
    admin
      .from('survey_laporan')
      .select('laporan_id, kepuasan_keseluruhan, submitted_at, nama_pelanggan, alamat, kondisi_setelah, kualitas_pelayanan, kecepatan_respon, ada_pungli, ada_tips, ada_3s, ada_identitas, ada_apd, ada_hal_tidak_senang, pesan_saran, laporan:laporan_id!inner(nomor_tiket, lokasi, status, ulp_id, resolved_at, resolved_petugas_names)')
      .eq('laporan.status', 'selesai')
      .in('laporan.ulp_id', filteredUlpIds)
      .gte('laporan.resolved_at', startDate)
      .lte('laporan.resolved_at', endDate)
      .order('submitted_at', { ascending: false }),
    admin.from('ulp').select('id, nama').in('id', ulpIds).order('nama'),
  ])

  if (rekapError) {
    // Paling sering: fungsi rekap_outage belum dijalankan di SQL Editor.
    console.error('[outage] rekap_outage gagal:', rekapError)
    return (
      <div style={{ padding: 32, maxWidth: 620, margin: '40px auto' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
          Dashboard Outage belum siap
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Fungsi agregasi <code>rekap_outage</code> belum ada di database. Jalankan{' '}
          <code>supabase/rekap_outage.sql</code> di SQL Editor Supabase, lalu muat ulang halaman ini.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, fontFamily: 'monospace' }}>
          {rekapError.message}
        </p>
      </div>
    )
  }

  const rekap = rekapRaw as unknown as RekapOutage
  const rekapSebelum = (rekapSebelumRaw ?? null) as unknown as RekapOutage | null
  const ulpMap = Object.fromEntries((ulpsRaw ?? []).map(u => [u.id as string, u.nama as string]))

  type SurveyJoin = {
    laporan_id: string; kepuasan_keseluruhan: string; submitted_at: string
    nama_pelanggan: string; alamat: string
    kondisi_setelah: string; kualitas_pelayanan: string; kecepatan_respon: string
    ada_pungli: string; ada_tips: string; ada_3s: string; ada_identitas: string
    ada_apd: string; ada_hal_tidak_senang: string; pesan_saran: string | null
    laporan: { nomor_tiket: string; lokasi: string; ulp_id: string; resolved_petugas_names: string[] | null }
  }

  const surveyList = ((surveysRaw ?? []) as unknown as SurveyJoin[]).map(s => ({
    nomorTiket:   s.laporan.nomor_tiket,
    lokasi:       s.laporan.lokasi,
    ulpNama:      ulpMap[s.laporan.ulp_id] ?? '—',
    // Snapshot nama petugas: terisi untuk 99,86% laporan selesai. Rantai
    // fallback lama (piket_petugas → petugas_apkt) dibuang karena hanya
    // menyelamatkan 8 baris dari 5.586, dengan biaya beberapa query per halaman.
    petugas:      s.laporan.resolved_petugas_names ?? [],
    kepuasan:     s.kepuasan_keseluruhan,
    submittedAt:  s.submitted_at,
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
  }))

  // Kalender: RPC mengembalikan hanya tanggal yang ada isinya. Di sini
  // dilengkapi jadi rangkaian penuh (1..lastDay, atau 12 bulan saat month=0)
  // supaya grid kalender tidak berlubang.
  const kalenderMap = Object.fromEntries((rekap.kalender ?? []).map(k => [k.tanggal, k]))
  const calendarDays: OutageData['calendarDays'] = []

  if (month === 0) {
    const perBulan: Record<number, Record<string, number>> = {}
    for (const k of rekap.kalender ?? []) {
      const m = parseInt(k.tanggal.substring(5, 7))
      perBulan[m] ??= {}
      for (const p of k.petugas) perBulan[m][p.nama] = (perBulan[m][p.nama] ?? 0) + p.jumlah
    }
    for (let m = 1; m <= 12; m++) {
      const isi = perBulan[m] ?? {}
      calendarDays.push({
        tanggal: `${year}-${String(m).padStart(2, '0')}`,
        petugas: Object.entries(isi).map(([nama, count]) => ({ nama, count })).sort((a, b) => b.count - a.count),
        total: (rekap.kalender ?? [])
          .filter(k => parseInt(k.tanggal.substring(5, 7)) === m)
          .reduce((s, k) => s + k.total, 0),
      })
    }
  } else {
    for (let d = 1; d <= lastDay; d++) {
      const tgl = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const k = kalenderMap[tgl]
      calendarDays.push({
        tanggal: tgl,
        petugas: (k?.petugas ?? []).map(p => ({ nama: p.nama, count: p.jumlah })),
        total: k?.total ?? 0,
      })
    }
  }

  const data: OutageData = {
    year, month,
    ulps: (ulpsRaw ?? []).map(u => ({ id: u.id as string, nama: u.nama as string })),
    selectedUlpId,
    totalSelesai: rekap.kpi.totalSelesai,
    petugasSelesaiList: (rekap.petugasSelesai ?? []).map(p => ({
      nama: p.nama, ulpNama: p.ulpNama, count: p.jumlah,
    })),
    petugasPuasList: (rekap.petugasPuas ?? []).map(p => ({
      nama: p.nama, ulpNama: p.ulpNama,
      sangat_puas: p.sangatPuas, puas: p.puas, biasa: p.biasa,
      tidak_puas: p.tidakPuas, sangat_tidak_puas: p.sangatTidakPuas,
      total: p.total,
    })),
    surveyList,
    calendarDays,
    rekap,
    rekapSebelum,
  }

  return <OutageClient data={data} profileRole={profile.role} />
}
