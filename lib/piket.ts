import type { createAdminClient } from '@/lib/supabase/admin'
import type { ShiftType } from '@/types'

export interface PiketAktif {
  id: string
  nama: ShiftType
  jamMulai: string
  jamSelesai: string
}

/**
 * Piket yang sedang berjalan untuk sebuah ULP, berdasarkan jam dinding WITA.
 * Menangani shift yang melewati tengah malam (mis. 16:00–00:00).
 *
 * Dipakai untuk membatasi rekap ke sesi piket berjalan. Catatan penting:
 * `laporan.piket_id` TIDAK bisa dipakai untuk itu — kolomnya NULL di seluruh
 * baris database. Yang terisi dan andal adalah `laporan.resolved_piket_id`,
 * diisi saat status diubah jadi 'selesai'.
 */
export async function cariPiketAktif(
  admin: ReturnType<typeof createAdminClient>,
  ulpId: string,
  now: Date = new Date(),
): Promise<PiketAktif | null> {
  const wita = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const tanggal = wita.toISOString().split('T')[0]
  const menitKini = wita.getUTCHours() * 60 + wita.getUTCMinutes()

  const { data: pikets } = await admin
    .from('piket')
    .select('id, shift_type:shift_type(nama, jam_mulai, jam_selesai)')
    .eq('ulp_id', ulpId)
    .eq('tanggal', tanggal)

  for (const p of pikets ?? []) {
    const st = p.shift_type as unknown as { nama: ShiftType; jam_mulai: string; jam_selesai: string } | null
    if (!st) continue
    const [mh, mm] = st.jam_mulai.split(':').map(Number)
    const [sh, sm] = st.jam_selesai.split(':').map(Number)
    const mulai = mh * 60 + (mm ?? 0)
    const selesai = sh * 60 + (sm ?? 0)
    const aktif = selesai > mulai
      ? menitKini >= mulai && menitKini < selesai
      : menitKini >= mulai || menitKini < selesai // shift melewati tengah malam
    if (aktif) {
      return { id: p.id as string, nama: st.nama, jamMulai: st.jam_mulai, jamSelesai: st.jam_selesai }
    }
  }
  return null
}
