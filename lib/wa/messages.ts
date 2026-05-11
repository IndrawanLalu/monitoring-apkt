import { STATUS_EMOJI, STATUS_LABEL, SHIFT_LABEL } from '@/constants'
import { formatTanggal, formatWaktu } from '@/lib/utils/format'
import type { StatusLaporan, ShiftType, Laporan, Regu } from '@/types'

interface LaporanWa {
  nomor_tiket: string
  nama_pelanggan: string
  nomor_pelanggan?: string | null
  lokasi: string
  keterangan?: string | null
  regu?: { nama: string } | null
}

export function buildPesanLaporanBaru(laporan: LaporanWa, magicUrl: string): string {
  const lines = [
    `🔴 *LAPORAN BARU | #${laporan.nomor_tiket}*`,
    `👤 Pelanggan : ${laporan.nama_pelanggan}${laporan.nomor_pelanggan ? ` | ${laporan.nomor_pelanggan}` : ''}`,
    `📍 Lokasi    : ${laporan.lokasi}`,
    `👷 Regu      : ${laporan.regu?.nama ?? '—'}`,
  ]

  if (laporan.keterangan) {
    lines.push(`📝 Ket       : ${laporan.keterangan}`)
  }

  lines.push(`🔗 Update    : ${magicUrl}`)

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
  } else {
    laporanAktif.forEach((l, i) => {
      lines.push(`${i + 1}. *#${l.nomor_tiket}* | ${l.nama_pelanggan} | ${l.lokasi}`)
      lines.push(`   Status: ${STATUS_EMOJI[l.status]} ${STATUS_LABEL[l.status]}`)
      if (l.keterangan) lines.push(`   _${l.keterangan}_`)
    })
    lines.push('')
    lines.push(`Total Aktif: *${laporanAktif.length} laporan*`)
  }

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

interface LaporanRekap {
  regu_id: string
  nomor_tiket: string
  nama_pelanggan: string
  status: StatusLaporan
  keterangan?: string | null
}

export function buildPesanRekapPiket(
  ulpNama: string,
  reguList: { id: string; nama: string }[],
  petugasList: { id: string; regu_id: string; nama: string }[],
  laporanList: LaporanRekap[],
  shiftNama: ShiftType,
  shiftJam: { mulai: string; selesai: string },
  now: Date,
  namaCc?: string | null,
): string {
  const lines = [
    `📊 *REKAP SERAH TERIMA — ${SHIFT_LABEL[shiftNama].toUpperCase()}*`,
    `${ulpNama} | ${formatTanggal(now)}`,
  ]

  if (namaCc) {
    lines.push(`👤 CC Piket : ${namaCc}`)
  }

  lines.push('')

  let grandTotal = 0
  let grandSelesai = 0
  let grandNyala = 0
  let grandBelum = 0

  reguList.forEach((regu) => {
    const petugas = petugasList.filter((p) => p.regu_id === regu.id)
    const namaPetugas = petugas.map((p) => p.nama).join(' & ') || '—'
    const regLaporan = laporanList.filter((l) => l.regu_id === regu.id)

    const selesai = regLaporan.filter((l) => l.status === 'selesai')
    const nyala = regLaporan.filter((l) => l.status === 'nyala_sementara')
    const belum = regLaporan.filter((l) => l.status === 'lapor')
    const total = regLaporan.length

    grandTotal += total
    grandSelesai += selesai.length
    grandNyala += nyala.length
    grandBelum += belum.length

    lines.push(`*${regu.nama} (${namaPetugas})*`)
    lines.push(`  ✅ Selesai          : ${selesai.length}`)

    if (nyala.length > 0) {
      lines.push(`  🟡 Nyala Sementara  : ${nyala.length}`)
      nyala.forEach((l) => {
        lines.push(`       - #${l.nomor_tiket} | ${l.nama_pelanggan}${l.keterangan ? ` : ${l.keterangan}` : ''}`)
      })
    } else {
      lines.push(`  🟡 Nyala Sementara  : 0`)
    }

    if (belum.length > 0) {
      lines.push(`  🔴 Belum Ditangani  : ${belum.length}`)
      belum.forEach((l) => {
        lines.push(`       - #${l.nomor_tiket} | ${l.nama_pelanggan}${l.keterangan ? ` : ${l.keterangan}` : ''}`)
      })
    } else {
      lines.push(`  🔴 Belum Ditangani  : 0`)
    }

    lines.push(`  📌 Total            : ${total}`)
    lines.push('')
  })

  lines.push(`─────────────────────`)
  lines.push(`*TOTAL ${ulpNama.toUpperCase()}*`)
  lines.push(`  ✅ Selesai          : ${grandSelesai}`)
  lines.push(`  🟡 Nyala Sementara  : ${grandNyala}`)
  lines.push(`  🔴 Belum            : ${grandBelum}`)
  lines.push(`  📌 Grand Total      : ${grandTotal}`)

  return lines.join('\n')
}
