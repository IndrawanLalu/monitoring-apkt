export const APKT_STATUS_MAP: Record<string, AppStatus> = {
  'Lapor': 'lapor',
  'Lapor (Keh Periksa)': 'lapor',
  'Menunggu Konfirmasi': 'lapor',
  'Penugasan Regu': 'lapor',
  'Dalam Perjalanan': 'ditangani',
  'Dalam Pengerjaan': 'ditangani',
  'Nyala Sementara': 'nyala_sementara',
  'Selesai': 'selesai',
} as const

export type AppStatus = 'lapor' | 'ditangani' | 'nyala_sementara' | 'selesai'

export type ScraperStatus =
  | 'idle'
  | 'waiting_login'
  | 'waiting_search'
  | 'running'
  | 'error'

export type ApktCommand = 'start_polling' | 'stop' | 'poll_now' | null

export interface LaporanApkt {
  nomorLapor: string
  namaPelanggan: string
  durasi: string
  status: string
  statusMapped: AppStatus
  alamatPelapor: string
  lokasi: string
  posko: string
  nomorTelepon: string
  deskripsi: string
  tanggalLapor: string
  reguId: string | null  // disimpan terpisah, tidak dari scraper
}

export interface ApktState {
  scraperStatus: ScraperStatus
  lastSync: string | null
  totalRows: number
  data: LaporanApkt[]
  error?: string
  pendingCommand: ApktCommand
  // Regu assignment disimpan terpisah dari data scraper supaya tidak
  // hilang saat polling refresh — key: nomorLapor, value: reguId
  reguAssignments: Record<string, string>
}
