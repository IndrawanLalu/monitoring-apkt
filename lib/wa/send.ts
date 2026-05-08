import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'
import { buildPesanLaporanBaru, buildPesanUpdateStatus } from '@/lib/wa/messages'
import { normJoin } from '@/lib/utils/format'
import type { StatusLaporan } from '@/types'

// Cari WA client yang aktif untuk sebuah ULP
async function getWaClientForUlp(ulpId: string) {
  const admin = createAdminClient()
  const { data: userUlps } = await admin
    .from('user_ulp')
    .select('user_id')
    .eq('ulp_id', ulpId)

  for (const { user_id } of userUlps ?? []) {
    const client = getWaClient(user_id)
    if (client) return client
  }
  return null
}

export async function kirimLaporanBaru(laporanId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('nomor_tiket, nama_pelanggan, nomor_pelanggan, lokasi, keterangan, magic_token, ulp_id, regu(id, nama), ulp(id, nama, wa_grup_id)')
    .eq('id', laporanId)
    .single()

  if (!laporan) return

  const ulp = normJoin(laporan.ulp as unknown as { id: string; nama: string; wa_grup_id: string | null } | null)
  if (!ulp?.wa_grup_id) return

  const waClient = await getWaClientForUlp(laporan.ulp_id)
  if (!waClient) return

  const regu = normJoin(laporan.regu as unknown as { id: string; nama: string } | null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const magicUrl = `${appUrl}/magic/${laporan.magic_token}`
  const pesan = buildPesanLaporanBaru({ ...laporan, regu }, magicUrl)

  const msg = await waClient.sendMessage(ulp.wa_grup_id, pesan)

  await admin
    .from('laporan')
    .update({ wa_message_id: msg.id._serialized })
    .eq('id', laporanId)
}

export async function kirimUpdateStatus(
  laporanId: string,
  status: StatusLaporan,
  keterangan?: string | null,
): Promise<void> {
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('nomor_tiket, wa_message_id, ulp_id, ulp(wa_grup_id), regu(nama)')
    .eq('id', laporanId)
    .single()

  if (!laporan) return

  const ulp = normJoin(laporan.ulp as unknown as { wa_grup_id: string | null } | null)
  if (!ulp?.wa_grup_id) return

  const waClient = await getWaClientForUlp(laporan.ulp_id)
  if (!waClient) return

  const regu = normJoin(laporan.regu as unknown as { nama: string } | null)
  const pesan = buildPesanUpdateStatus(
    laporan.nomor_tiket,
    status,
    regu?.nama ?? '—',
    keterangan ?? null,
  )

  try {
    if (laporan.wa_message_id) {
      const originalMsg = await waClient.getMessageById(laporan.wa_message_id)
      if (originalMsg) {
        await originalMsg.reply(pesan)
      } else {
        await waClient.sendMessage(ulp.wa_grup_id, pesan)
      }
    } else {
      await waClient.sendMessage(ulp.wa_grup_id, pesan)
    }
  } catch {
    await waClient.sendMessage(ulp.wa_grup_id, pesan)
  }
}
