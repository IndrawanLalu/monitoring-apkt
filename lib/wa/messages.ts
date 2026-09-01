import { STATUS_EMOJI, STATUS_LABEL, SHIFT_LABEL } from '@/constants'
import { formatTanggal, formatWaktu, formatTanggalWaktu, formatDurasi } from '@/lib/utils/format'
import type { StatusLaporan, ShiftType, Laporan, Regu } from '@/types'

interface LaporanWa {
  nomor_tiket: string
  nama_pelanggan: string
  nomor_pelanggan?: string | null
  lokasi: string
  keterangan?: string | null
  regu?: { nama: string } | null
}

export function buildPesanLaporanBaru(
  laporan: LaporanWa,
  nomorAntrian?: number | null,
  /** Nomor WA regu untuk di-tag, mis. "6281917234567". */
  mentionNomor?: string | null,
): string {
  // Bullet WhatsApp, bukan perataan kolom pakai spasi — font WhatsApp
  // proporsional, jadi titik dua tidak pernah sejajar dan baris panjang
  // melipat tanpa indentasi. Lihat catatan di itemLaporan().
  const lines = [
    `🔴 *LAPORAN BARU*`,
    `*#${laporan.nomor_tiket}*`,
    `* ${laporan.nama_pelanggan}${laporan.nomor_pelanggan ? ` | ${laporan.nomor_pelanggan}` : ''}`,
    `* Alamat: ${laporan.lokasi}`,
    mentionNomor
      ? `* Regu: *${laporan.regu?.nama ?? '—'}* (@${mentionNomor})`
      : `* Regu: ${laporan.regu?.nama ?? '—'}`,
  ]

  if (nomorAntrian && nomorAntrian > 0) {
    lines.push(`* Antrian: No. ${nomorAntrian}`)
  }

  if (laporan.keterangan) {
    lines.push(`* _${laporan.keterangan}_`)
  }

  return lines.join('\n')
}

export function buildPesanUpdateStatus(
  nomorTiket: string,
  status: StatusLaporan,
  namaRegu: string,
  keterangan: string | null,
): string {
  const emoji = STATUS_EMOJI[status]
  const label = STATUS_LABEL[status]
  const jam = formatWaktu(new Date())

  const lines = [
    `↩️ *#${nomorTiket}*`,
    `${emoji} Status: *${label}*`,
    `🕐 ${jam} | ${namaRegu}`,
  ]

  if (keterangan) {
    lines.push(`📝 ${keterangan}`)
  }

  return lines.join('\n')
}

interface PetugasMin { nama: string }
interface LaporanAktif {
  nomor_tiket: string
  nama_pelanggan: string
  lokasi: string
  status: StatusLaporan
  keterangan?: string | null
  created_at?: string
}

/**
 * Satu laporan dalam bentuk daftar bullet WhatsApp.
 *
 * Dua hal yang disengaja dan jangan "dirapikan":
 * - `1.#TIKET` TANPA spasi setelah titik. Dengan spasi, WhatsApp mengubahnya jadi
 *   daftar bernomor yang bentrok dengan bullet '*' di bawahnya.
 * - Baris detail diawali '* ' supaya WhatsApp merendernya sebagai bullet asli.
 *   Bullet punya indentasi sendiri, jadi teks panjang yang melipat di layar HP
 *   tetap masuk ke dalam butirnya — bukan terbaca seperti field baru. Ini yang
 *   menggantikan perataan kolom pakai spasi, yang tidak pernah rata di WhatsApp
 *   karena fontnya proporsional, bukan monospace.
 */
function itemLaporan(l: LaporanAktif, no: number, now: Date): string[] {
  const baris = [
    `${no}.*#${l.nomor_tiket}*`,
    `* ${l.nama_pelanggan}`,
    `* Alamat: ${l.lokasi}`,
    `* Status: ${STATUS_EMOJI[l.status]} ${STATUS_LABEL[l.status]}`,
  ]
  if (l.created_at) baris.push(`* Durasi: ${formatDurasi(l.created_at, now)}`)
  if (l.keterangan) baris.push(`* _${l.keterangan}_`)
  return baris
}

export function buildPesanLaporanRegu(
  regu: Pick<Regu, 'nama'>,
  petugasList: PetugasMin[],
  laporanAktif: LaporanAktif[],
  shiftNama: ShiftType,
  shiftJam: { mulai: string; selesai: string },
  now: Date,
): string {
  const namaPetugas = petugasList.map((p) => p.nama).join(' & ') || '—'
  const lines = [
    `📋 *LAPORAN AKTIF — ${regu.nama.toUpperCase()}*`,
    `${namaPetugas}`,
    `${SHIFT_LABEL[shiftNama]} | ${shiftJam.mulai}–${shiftJam.selesai} | ${formatTanggal(now)}`,
    '',
  ]

  if (laporanAktif.length === 0) {
    lines.push('_Tidak ada laporan aktif_')
    return lines.join('\n')
  }

  laporanAktif.forEach((l, i) => {
    lines.push(...itemLaporan(l, i + 1, now))
    lines.push('')
  })

  lines.push(`Total Aktif: *${laporanAktif.length} laporan*`)

  return lines.join('\n')
}

interface ApktPenugasanWa {
  nomorLapor: string
  namaPelanggan: string
  lokasi: string
  statusApkt: string
  namaRegu: string
}

export function buildPesanApktPenugasan(data: ApktPenugasanWa): string {
  return [
    `📋 *PENUGASAN APKT*`,
    `🎫 No. Tiket : #${data.nomorLapor}`,
    `👤 Pelanggan : ${data.namaPelanggan}`,
    `📍 Lokasi    : ${data.lokasi}`,
    `📊 Status    : ${data.statusApkt}`,
    `👷 Ditugaskan: ${data.namaRegu}`,
  ].join('\n')
}

interface LaporanBelumSelesai {
  regu_id: string | null
  nomor_tiket: string
  nama_pelanggan: string
  lokasi: string
  keterangan?: string | null
  status: StatusLaporan
  created_at: string
}

/**
 * Rekap gangguan belum selesai (semua status ≠ selesai) untuk 1 ULP,
 * dikelompokkan per regu, disertai durasi sejak laporan dibuat.
 * Dikirim otomatis tiap 3 jam ke grup WA masing-masing ULP.
 */
/** Jumlah laporan per status untuk satu sesi piket. */
export interface HitunganSesi {
  lapor: number
  penugasan_regu: number
  ditangani: number
  nyala_sementara: number
  selesai: number
}

export function buildPesanRekapGangguan(
  ulpNama: string,
  reguList: { id: string; nama: string }[],
  laporanList: LaporanBelumSelesai[],
  now: Date,
  /** Hitungan status untuk sesi piket berjalan. Tanpa ini, blok hitungan dilewati. */
  sesi?: { shiftNama: ShiftType; jamMulai: string; jamSelesai: string; hitungan: HitunganSesi } | null,
): string {
  const lines = [`📋 *REKAP GANGGUAN*`, `${ulpNama} | ${formatTanggalWaktu(now)}`]

  // Blok hitungan dibatasi sesi piket berjalan — bukan sejak awal data.
  // "Selesai" khususnya: tanpa pembatasan ini angkanya jadi total sepanjang masa.
  if (sesi) {
    const h = sesi.hitungan
    const total = h.lapor + h.penugasan_regu + h.ditangani + h.nyala_sementara + h.selesai
    lines.push(
      '',
      `*${SHIFT_LABEL[sesi.shiftNama]} | ${sesi.jamMulai}–${sesi.jamSelesai}*`,
      `* 🔴 Lapor: ${h.lapor}`,
      `* 🟤 Penugasan Regu: ${h.penugasan_regu}`,
      `* 🟡 Sedang Ditangani: ${h.ditangani}`,
      `* 🟠 Nyala Sementara: ${h.nyala_sementara}`,
      `* ✅ Selesai: ${h.selesai}`,
      `* 📌 Total: ${total}`,
    )
  }

  if (laporanList.length === 0) {
    lines.push('', '✅ _Tidak ada gangguan belum selesai_ 🎉')
    return lines.join('\n')
  }

  const byCreated = (a: LaporanBelumSelesai, b: LaporanBelumSelesai) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

  const render = (items: LaporanBelumSelesai[], judul: string) => {
    lines.push('', `*BELUM SELESAI — ${judul}* (${items.length})`)
    items.forEach((l, i) => lines.push(...itemLaporan(l as LaporanAktif, i + 1, now)))
  }

  // Per regu terdaftar
  reguList.forEach((regu) => {
    const items = laporanList.filter((l) => l.regu_id === regu.id).sort(byCreated)
    if (items.length > 0) render(items, regu.nama.toUpperCase())
  })

  // Laporan tanpa regu / regu tidak dikenal (belum ditugaskan)
  const reguIds = new Set(reguList.map((r) => r.id))
  const tanpaRegu = laporanList.filter((l) => !l.regu_id || !reguIds.has(l.regu_id)).sort(byCreated)
  if (tanpaRegu.length > 0) render(tanpaRegu, 'BELUM DITUGASKAN')

  lines.push('', `Total belum selesai: *${laporanList.length}*`)

  return lines.join('\n')
}

/** Baris hitungan: Selesai selalu tampil, status terbuka hanya bila > 0. */
function barisHitungan(h: HitunganSesi): string[] {
  const out = [`* ✅ Selesai: ${h.selesai}`]
  if (h.lapor > 0) out.push(`* 🔴 Lapor: ${h.lapor}`)
  if (h.penugasan_regu > 0) out.push(`* 🟤 Penugasan Regu: ${h.penugasan_regu}`)
  if (h.ditangani > 0) out.push(`* 🟡 Sedang Ditangani: ${h.ditangani}`)
  if (h.nyala_sementara > 0) out.push(`* 🟠 Nyala Sementara: ${h.nyala_sementara}`)
  const total = h.selesai + h.lapor + h.penugasan_regu + h.ditangani + h.nyala_sementara
  out.push(`* 📌 Total: ${total}`)
  return out
}

function hitung(selesai: number, belum: LaporanBelumSelesai[]): HitunganSesi {
  return {
    selesai,
    lapor: belum.filter((l) => l.status === 'lapor').length,
    penugasan_regu: belum.filter((l) => l.status === 'penugasan_regu').length,
    ditangani: belum.filter((l) => l.status === 'ditangani').length,
    nyala_sementara: belum.filter((l) => l.status === 'nyala_sementara').length,
  }
}

/**
 * Rekap serah terima piket.
 *
 * `selesaiList` HARUS sudah dibatasi ke piket berjalan lewat `resolved_piket_id`.
 * Versi lama mengambil seluruh laporan ULP tanpa filter tanggal, kena batas 1000
 * baris Supabase, dan mencetak angka seperti "999" yang sebenarnya adalah batas
 * itu sendiri — bukan hasil hitungan.
 */
export function buildPesanRekapPiket(
  ulpNama: string,
  reguList: { id: string; nama: string }[],
  petugasList: { id: string; regu_id: string; nama: string }[],
  selesaiList: { regu_id: string | null }[],
  belumList: LaporanBelumSelesai[],
  shiftNama: ShiftType,
  shiftJam: { mulai: string; selesai: string },
  now: Date,
  namaCc?: string | null,
): string {
  const lines = [
    `📊 *REKAP SERAH TERIMA*`,
    `${ulpNama} | ${formatTanggalWaktu(now)}`,
    `*${SHIFT_LABEL[shiftNama]} | ${shiftJam.mulai}–${shiftJam.selesai}*`,
  ]
  if (namaCc) lines.push(`👤 CC Piket: ${namaCc}`)

  reguList.forEach((regu) => {
    const namaPetugas = petugasList.filter((p) => p.regu_id === regu.id).map((p) => p.nama).join(' & ') || '—'
    const h = hitung(
      selesaiList.filter((l) => l.regu_id === regu.id).length,
      belumList.filter((l) => l.regu_id === regu.id),
    )
    lines.push('', `*${regu.nama.toUpperCase()}* (${namaPetugas})`, ...barisHitungan(h))
  })

  // Laporan yang tidak terhubung ke regu ULP ini — jangan sampai hilang dari total.
  const reguIds = new Set(reguList.map((r) => r.id))
  const luarSelesai = selesaiList.filter((l) => !l.regu_id || !reguIds.has(l.regu_id))
  const luarBelum = belumList.filter((l) => !l.regu_id || !reguIds.has(l.regu_id))
  if (luarSelesai.length > 0 || luarBelum.length > 0) {
    lines.push('', `*BELUM DITUGASKAN*`, ...barisHitungan(hitung(luarSelesai.length, luarBelum)))
  }

  lines.push('', `*TOTAL ${ulpNama.toUpperCase()}*`, ...barisHitungan(hitung(selesaiList.length, belumList)))

  // Rincian yang diserahterimakan ke shift berikutnya.
  if (belumList.length > 0) {
    const byCreated = (a: LaporanBelumSelesai, b: LaporanBelumSelesai) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    lines.push('', `*DISERAHTERIMAKAN* (${belumList.length})`)
    belumList.slice().sort(byCreated).forEach((l, i) => lines.push(...itemLaporan(l as LaporanAktif, i + 1, now)))
  }

  return lines.join('\n')
}
