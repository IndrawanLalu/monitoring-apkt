import { z } from 'zod'
import { STATUS_LAPORAN } from '@/constants'

export const createLaporanSchema = z.object({
  nomor_tiket: z.string().min(1, 'Nomor tiket wajib diisi').max(50),
  regu_id: z.string().uuid('Regu tidak valid'),
  nama_pelanggan: z.string().min(1, 'Nama pelanggan wajib diisi').max(100),
  nomor_pelanggan: z.string().max(20).nullable().optional(),
  lokasi: z.string().min(1, 'Lokasi wajib diisi').max(200),
  keterangan: z.string().max(500).nullable().optional(),
  piket_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  status: z.enum(['lapor', 'penugasan_regu', 'ditangani', 'nyala_sementara', 'selesai']).optional(),
})

export const ccCallbackLaporanSchema = z.object({
  nomor_tiket: z.string().min(1, 'Nomor tiket wajib diisi').max(50),
  nama_pelanggan: z.string().min(1, 'Nama pelanggan wajib diisi').max(100),
  nomor_pelanggan: z.string().max(20).nullable().optional(),
  lokasi: z.string().min(1, 'Lokasi wajib diisi').max(200),
  keterangan: z.string().max(500).nullable().optional(),
  created_at: z.string().datetime().optional(),
  status: z.enum(['lapor', 'penugasan_regu', 'ditangani', 'nyala_sementara', 'selesai']).optional(),
  status_callback: z.string().optional(),
})

export const updateStatusSchema = z.object({
  laporan_id: z.string().uuid('ID laporan tidak valid'),
  status: z.enum([
    STATUS_LAPORAN.LAPOR,
    STATUS_LAPORAN.PENUGASAN_REGU,
    STATUS_LAPORAN.DITANGANI,
    STATUS_LAPORAN.NYALA_SEMENTARA,
    STATUS_LAPORAN.SELESAI,
  ]),
  keterangan: z.string().max(500).nullable().optional(),
})

export type CreateLaporanInput = z.infer<typeof createLaporanSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type CcCallbackLaporanInput = z.infer<typeof ccCallbackLaporanSchema>

// Survey kepuasan pelanggan. Nilai sahnya sebelumnya hanya tertulis sebagai
// komentar di supabase/survey_laporan.sql sementara API menerima string apa pun,
// sehingga nilai ngawur bisa masuk dan ikut dihitung di agregasi /rekap-survey.
const SKALA = ['sangat_buruk', 'buruk', 'cukup', 'baik', 'sangat_baik'] as const
const ADA = ['ada', 'tidak_ada'] as const

export const surveySchema = z.object({
  kondisi_setelah: z.enum(['tidak_ada', 'kadang_padam', 'padam_sekarang']),
  kualitas_pelayanan: z.enum(SKALA),
  kecepatan_respon: z.enum(SKALA),
  ada_pungli: z.enum(ADA),
  ada_tips: z.enum(ADA),
  ada_3s: z.enum(ADA),
  ada_identitas: z.enum(ADA),
  ada_apd: z.enum(ADA),
  ada_hal_tidak_senang: z.enum(ADA),
  kepuasan_keseluruhan: z.enum([
    'sangat_puas', 'puas', 'biasa', 'tidak_puas', 'sangat_tidak_puas',
  ]),
  pesan_saran: z.string().max(1000).nullable().optional(),
})

export type SurveyInput = z.infer<typeof surveySchema>
