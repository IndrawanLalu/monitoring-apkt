import { createAdminClient } from '@/lib/supabase/admin'
import { buildPesanLaporanBaru, buildPesanUpdateStatus } from '@/lib/wa/messages'
import { normJoin } from '@/lib/utils/format'
import { getOpenSessionForUlp, gatewaySend } from '@/lib/wa/gateway'
import type { StatusLaporan } from '@/types'

/**
 * Kirim teks ke grup WA sebuah ULP lewat wa-gateway (Baileys).
 * Melempar Error dengan pesan yang layak ditampilkan ke pengguna kalau tidak
 * ada sesi WA yang bisa dipakai.
 *
 * Dipakai bersama oleh /api/wa/kirim-regu, /api/wa/rekap-piket, dan
 * lib/wa/rekap-gangguan.ts — dua route pertama sempat tertinggal saat migrasi
 * ke gateway dan diam-diam tidak pernah mengirim apa pun.
 */
export async function kirimTeksKeGrupUlp(
  ulpId: string,
  waGrupId: string,
  text: string,
  mentions?: string[],
): Promise<void> {
  const sessionId = await getOpenSessionForUlp(ulpId)
  if (!sessionId) {
    throw new Error('Tidak ada sesi WhatsApp yang terhubung di gateway untuk ULP ini. Hubungkan WA dulu di Settings.')
  }
  await gatewaySend(sessionId, { to: waGrupId, text, mentions })
}

/** Jam WITA (UTC+8) saat ini — jangan pakai getHours() yang ikut timezone mesin. */
export function jamWita(now: Date = new Date()): number {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).getUTCHours()
}

function formatWaNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('62')) return clean
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  return '62' + clean
}

export async function kirimLaporanBaru(laporanId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('nomor_tiket, nama_pelanggan, nomor_pelanggan, lokasi, keterangan, created_at, ulp_id, regu(id, nama, nomor_hp), ulp(id, nama, wa_grup_id)')
    .eq('id', laporanId)
    .single()

  if (!laporan) return

  const ulp = normJoin(laporan.ulp as unknown as { id: string; nama: string; wa_grup_id: string | null } | null)
  if (!ulp?.wa_grup_id) return

  const regu = normJoin(laporan.regu as unknown as { id: string; nama: string; nomor_hp?: string | null } | null)

  const waNum = formatWaNumber(regu?.nomor_hp)

  // Nomor antrian = posisi laporan ini di antrian regu (belum selesai, urut created_at) —
  // sama persis dengan yang dilihat pelanggan di /antrian/[token].
  //
  // Dihitung lewat count, bukan dengan menarik seluruh baris lalu findIndex():
  // versi lama memindahkan N baris dari database untuk mencari satu angka, dan
  // itu terjadi pada SETIAP laporan baru.
  let nomorAntrian: number | null = null
  if (regu?.id && laporan.created_at) {
    const { count } = await admin
      .from('laporan')
      .select('*', { count: 'exact', head: true })
      .eq('regu_id', regu.id)
      .neq('status', 'selesai')
      .lte('created_at', laporan.created_at as string)
    if (count && count > 0) nomorAntrian = count
  }

  // Nomor mention dioper ke builder, bukan ditambal lewat string replace —
  // replace lama diam-diam gagal begitu format pesannya berubah.
  const pesan = buildPesanLaporanBaru({ ...laporan, regu }, nomorAntrian, waNum)

  const sessionId = await getOpenSessionForUlp(laporan.ulp_id)
  if (!sessionId) return
  const { id } = await gatewaySend(sessionId, {
    to: ulp.wa_grup_id,
    text: pesan,
    mentions: waNum ? [waNum] : undefined,
  })
  if (id) {
    await admin.from('laporan').update({ wa_message_id: id }).eq('id', laporanId)
  }
}

export async function kirimUpdateStatus(
  laporanId: string,
  status: StatusLaporan,
  keterangan?: string | null,
): Promise<void> {
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('nomor_tiket, wa_message_id, ulp_id, ulp(wa_grup_id), regu(nama, nomor_hp)')
    .eq('id', laporanId)
    .single()

  if (!laporan) return

  const ulp = normJoin(laporan.ulp as unknown as { wa_grup_id: string | null } | null)
  if (!ulp?.wa_grup_id) return

  const regu = normJoin(laporan.regu as unknown as { nama: string; nomor_hp?: string | null } | null)
  let pesan = buildPesanUpdateStatus(
    laporan.nomor_tiket,
    status,
    regu?.nama ?? '—',
    keterangan ?? null,
  )

  const waNum = formatWaNumber(regu?.nomor_hp)

  if (waNum) {
    pesan = pesan.replace(`| ${regu?.nama}`, `| *${regu?.nama}* (@${waNum})`)
  }

  const sessionId = await getOpenSessionForUlp(laporan.ulp_id)
  if (!sessionId) return
  await gatewaySend(sessionId, {
    to: ulp.wa_grup_id,
    text: pesan,
    mentions: waNum ? [waNum] : undefined,
    replyTo: laporan.wa_message_id ?? undefined, // reply ke pesan laporan asli
  })
}
