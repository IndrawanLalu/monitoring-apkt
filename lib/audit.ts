import { createAdminClient } from '@/lib/supabase/admin'
import { ringkasGalat } from '@/lib/log'

/**
 * Jejak audit tindakan terhadap akun pengguna.
 *
 * Sebelumnya tidak ada catatan sama sekali tentang siapa membuat, mengubah
 * peran, mereset password, atau menghapus akun — kalau suatu saat ada
 * pertanyaan "siapa yang memberi orang ini akses UP3?", tidak ada jawabannya.
 *
 * Sengaja TIDAK menyimpan password, dan tidak menggagalkan aksi utama kalau
 * pencatatannya gagal: gagal mencatat lebih baik daripada gagal mereset
 * password petugas yang sedang menunggu.
 */

export type AksiAudit =
  | 'buat_user'
  | 'ubah_user'
  | 'ubah_peran'
  | 'reset_password'
  | 'hapus_user'

export interface CatatanAudit {
  aktorId: string
  aktorNama: string
  aksi: AksiAudit
  sasaranId: string | null
  sasaranNama: string | null
  /** Ringkasan singkat, mis. "operator → up3". Jangan memuat rahasia. */
  keterangan?: string | null
}

export async function catatAudit(c: CatatanAudit): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_user').insert({
      aktor_id: c.aktorId,
      aktor_nama: c.aktorNama,
      aksi: c.aksi,
      sasaran_id: c.sasaranId,
      sasaran_nama: c.sasaranNama,
      keterangan: c.keterangan ?? null,
    })
    if (error) console.error('[audit] gagal mencatat:', error.message)
  } catch (e) {
    console.error('[audit] gagal mencatat:', ringkasGalat(e))
  }
}
