export const STATUS_LAPORAN = {
  LAPOR: 'lapor',
  PENUGASAN_REGU: 'penugasan_regu',
  DITANGANI: 'ditangani',
  NYALA_SEMENTARA: 'nyala_sementara',
  SELESAI: 'selesai',
} as const

export type StatusLaporan = (typeof STATUS_LAPORAN)[keyof typeof STATUS_LAPORAN]

export const STATUS_LABEL: Record<StatusLaporan, string> = {
  lapor: 'Lapor',
  penugasan_regu: 'Penugasan Regu',
  ditangani: 'Sedang Ditangani',
  nyala_sementara: 'Nyala Sementara',
  selesai: 'Selesai',
}

export const STATUS_EMOJI: Record<StatusLaporan, string> = {
  lapor: '🔴',
  penugasan_regu: '🟤',
  ditangani: '🟡',
  nyala_sementara: '🟠',
  selesai: '✅',
}

export const STATUS_COLOR: Record<StatusLaporan, { bg: string; text: string; css: string }> = {
  lapor: { bg: '#E4002B', text: '#FFFFFF', css: 'status-lapor' },
  penugasan_regu: { bg: '#F5A623', text: '#FFFFFF', css: 'status-penugasan-regu' },
  ditangani: { bg: '#0070C0', text: '#FFFFFF', css: 'status-ditangani' },
  nyala_sementara: { bg: '#FFD200', text: '#1A1A1A', css: 'status-nyala-sementara' },
  selesai: { bg: '#1DB954', text: '#FFFFFF', css: 'status-selesai' },
}

/**
 * Peran pengguna, mencerminkan hierarki PLN: UIW → UP3 → ULP.
 *
 *   SUPER_ADMIN  seluruh sistem; mengelola UIW, UP3, dan semua user
 *   UIW          semua UP3 di wilayahnya
 *   UP3          semua ULP di UP3-nya
 *   OPERATOR     hanya ULP yang di-assign padanya
 *
 * ADMIN, CC, dan SUPERVISOR adalah nilai LAMA. Setelah migrasi tidak ada
 * baris yang memakainya, tapi tetap dikenali kode supaya akun yang belum
 * termigrasi — atau database yang belum dijalankan migrasinya — tidak
 * kehilangan akses secara mendadak.
 */
export const ROLE = {
  SUPER_ADMIN: 'super_admin',
  UIW: 'uiw',
  UP3: 'up3',
  OPERATOR: 'operator',
  // ── lama, jangan dipakai untuk akun baru ──
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  CC: 'cc',
} as const

/** Peran yang boleh mengelola user, ULP, dan pengaturan. */
export const PERAN_PENGELOLA = ['super_admin', 'uiw', 'up3', 'admin'] as const

/** Peran yang cakupannya seluruh sistem. */
export const PERAN_SUPER = ['super_admin'] as const

/** Label peran untuk ditampilkan ke pengguna. */
export const LABEL_ROLE: Record<string, string> = {
  super_admin: 'Super Admin',
  uiw: 'Admin UIW',
  up3: 'Admin UP3',
  operator: 'Operator',
  admin: 'Admin UP3 (lama)',
  cc: 'Operator (lama)',
  supervisor: 'Supervisor (lama)',
}

/** Peran mana yang boleh dibuat oleh peran tertentu. Mencegah eskalasi. */
export const BOLEH_MEMBUAT: Record<string, string[]> = {
  super_admin: ['uiw', 'up3', 'operator'],
  uiw:         ['up3', 'operator'],
  up3:         ['operator'],
  admin:       ['operator'], // peran lama, disamakan dengan up3
}

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
