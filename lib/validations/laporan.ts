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

export const magicUpdateSchema = z.object({
  token: z.string().min(1),
  status: z.enum([
    STATUS_LAPORAN.DITANGANI,
    STATUS_LAPORAN.NYALA_SEMENTARA,
    STATUS_LAPORAN.SELESAI,
  ]),
  keterangan: z.string().max(500).nullable().optional(),
})

export type CreateLaporanInput = z.infer<typeof createLaporanSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type MagicUpdateInput = z.infer<typeof magicUpdateSchema>
export type CcCallbackLaporanInput = z.infer<typeof ccCallbackLaporanSchema>
