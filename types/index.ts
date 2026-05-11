import type { StatusLaporan, Role, ShiftType, WaSessionStatus, UpdatedBy } from '@/constants'

export type { StatusLaporan, Role, ShiftType, WaSessionStatus, UpdatedBy }

export interface Ulp {
  id: string
  nama: string
  kode: string
  wa_grup_id: string | null
  created_at: string
}

export interface Regu {
  id: string
  ulp_id: string
  nama: string
  nomor_hp: string | null
  created_at: string
  ulp?: Ulp
}

export interface Petugas {
  id: string
  ulp_id: string
  regu_id: string | null
  nama: string
  nomor_hp: string | null
  created_at: string
  regu?: Regu
  ulp?: Ulp
}

export interface PiketPetugas {
  id: string
  piket_id: string
  regu_id: string
  petugas_id: string
  created_at: string
  petugas?: Petugas
}

export interface ShiftTypeRow {
  id: string
  nama: ShiftType
  jam_mulai: string
  jam_selesai: string
}

export interface Piket {
  id: string
  ulp_id: string
  shift_type_id: string
  tanggal: string
  nama_cc: string | null
  created_at: string
  ulp?: Ulp
  shift_type?: ShiftTypeRow
}

export interface Laporan {
  id: string
  nomor_tiket: string
  ulp_id: string
  piket_id: string | null
  regu_id: string
  nama_pelanggan: string
  nomor_pelanggan: string | null
  lokasi: string
  status: StatusLaporan
  keterangan: string | null
  magic_token: string
  wa_message_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  regu?: Regu
  ulp?: Ulp
  piket?: Piket
}

export interface RiwayatStatus {
  id: string
  laporan_id: string
  status_lama: StatusLaporan
  status_baru: StatusLaporan
  keterangan: string | null
  updated_by: UpdatedBy
  created_at: string
  laporan?: Laporan
}

export interface WaSession {
  id: string
  user_id: string
  status: WaSessionStatus
  session_data: Record<string, unknown> | null
  updated_at: string
}

export interface Profile {
  id: string
  ulp_id: string
  nama: string
  role: Role
  created_at: string
  ulp?: Ulp
}

/* ─── API response shapes ─── */

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

/* ─── Dashboard computed types ─── */

export interface ReguStats {
  regu: Regu
  petugas: Petugas[]
  laporan: Laporan[]
  total: number
  lapor: number
  ditangani: number
  nyala_sementara: number
  selesai: number
}

export interface DashboardData {
  piket: Piket
  reguStats: ReguStats[]
  totalLaporan: number
  totalLapor: number
  totalDitangani: number
  totalNyalaSementara: number
  totalSelesai: number
}

/* ─── WhatsApp ─── */

export interface WaQrEvent {
  ulp_id: string
  qr_data_url: string
}

export interface WaReadyEvent {
  ulp_id: string
  wa_number: string
}

export interface WaStatusEvent {
  ulp_id: string
  status: WaSessionStatus
}

/* ─── Magic Link ─── */

export interface MagicLinkLaporan {
  id: string
  nomor_tiket: string
  nama_pelanggan: string
  lokasi: string
  status: StatusLaporan
  keterangan: string | null
  regu: Pick<Regu, 'id' | 'nama'>
}
