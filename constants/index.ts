export const STATUS_LAPORAN = {
  LAPOR: 'lapor',
  DITANGANI: 'ditangani',
  NYALA_SEMENTARA: 'nyala_sementara',
  SELESAI: 'selesai',
} as const

export type StatusLaporan = (typeof STATUS_LAPORAN)[keyof typeof STATUS_LAPORAN]

export const STATUS_LABEL: Record<StatusLaporan, string> = {
  lapor: 'Lapor',
  ditangani: 'Sedang Ditangani',
  nyala_sementara: 'Nyala Sementara',
  selesai: 'Selesai',
}

export const STATUS_EMOJI: Record<StatusLaporan, string> = {
  lapor: '🔴',
  ditangani: '🟡',
  nyala_sementara: '🟠',
  selesai: '✅',
}

export const STATUS_COLOR: Record<StatusLaporan, { bg: string; text: string; css: string }> = {
  lapor: { bg: '#E4002B', text: '#FFFFFF', css: 'status-lapor' },
  ditangani: { bg: '#0070C0', text: '#FFFFFF', css: 'status-ditangani' },
  nyala_sementara: { bg: '#FFD200', text: '#1A1A1A', css: 'status-nyala-sementara' },
  selesai: { bg: '#1DB954', text: '#FFFFFF', css: 'status-selesai' },
}

export const ROLE = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  CC: 'cc',
} as const

export type Role = (typeof ROLE)[keyof typeof ROLE]

export const SHIFT_TYPE = {
  PAGI: 'pagi',
  SORE: 'sore',
  MALAM: 'malam',
} as const

export type ShiftType = (typeof SHIFT_TYPE)[keyof typeof SHIFT_TYPE]

export const SHIFT_LABEL: Record<ShiftType, string> = {
  pagi: 'Shift Pagi',
  sore: 'Shift Sore',
  malam: 'Shift Malam',
}

export const SHIFT_JAM: Record<ShiftType, { mulai: string; selesai: string }> = {
  pagi: { mulai: '08:00', selesai: '16:00' },
  sore: { mulai: '16:00', selesai: '00:00' },
  malam: { mulai: '00:00', selesai: '08:00' },
}

export const WA_SESSION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  SCANNING: 'scanning',
  LOADING: 'loading',
} as const

export type WaSessionStatus = (typeof WA_SESSION_STATUS)[keyof typeof WA_SESSION_STATUS]

export const PLN_COLORS = {
  blue: '#003B8E',
  blueMid: '#0070C0',
  yellow: '#FFD200',
  red: '#E4002B',
  orange: '#F5A623',
  green: '#1DB954',
  black: '#1A1A1A',
  white: '#FAFAFA',
  gray: '#E5E5E5',
} as const

export const UPDATED_BY = {
  CC: 'cc',
  PETUGAS: 'petugas',
  SYSTEM: 'system',
} as const

export type UpdatedBy = (typeof UPDATED_BY)[keyof typeof UPDATED_BY]
