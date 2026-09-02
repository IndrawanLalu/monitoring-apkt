import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  // Sengaja longgar: ini hanya memeriksa bentuk isian saat login, bukan
  // menetapkan kekuatan password. Akun lama berpassword pendek harus tetap
  // bisa masuk — aturan ketat berlaku saat MEMBUAT atau MENGGANTI password.
  password: z.string().min(1, 'Password wajib diisi'),
})

/**
 * Aturan password saat dibuat atau diganti.
 *
 * Sebelumnya minimal 6 karakter tanpa syarat lain, padahal akun-akun ini
 * memegang data pelanggan seluruh ULP. Delapan karakter dengan huruf dan
 * angka adalah dasar yang wajar tanpa membuat petugas lapangan kesulitan.
 */
export const passwordBaruSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .refine((v) => /[a-zA-Z]/.test(v), 'Password harus memuat huruf')
  .refine((v) => /[0-9]/.test(v), 'Password harus memuat angka')

export type LoginInput = z.infer<typeof loginSchema>
