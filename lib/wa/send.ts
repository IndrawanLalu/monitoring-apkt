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
    .select('nomor_tiket, nama_pelanggan, nomor_pelanggan, lokasi, keterangan, magic_token, ulp_id, regu(id, nama, nomor_hp), ulp(id, nama, wa_grup_id)')
    .eq('id', laporanId)
    .single()

  if (!laporan) return

  const ulp = normJoin(laporan.ulp as unknown as { id: string; nama: string; wa_grup_id: string | null } | null)
  if (!ulp?.wa_grup_id) return

  const waClient = await getWaClientForUlp(laporan.ulp_id)
  if (!waClient) return

  const regu = normJoin(laporan.regu as unknown as { id: string; nama: string; nomor_hp?: string | null } | null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const magicUrl = `${appUrl}/magic/${laporan.magic_token}`
  
  const waNum = formatWaNumber(regu?.nomor_hp)
  const mentions = waNum ? [`${waNum}@c.us`] : undefined

  // Sertakan tag/mention ke dalam pesan
  let pesan = buildPesanLaporanBaru({ ...laporan, regu }, magicUrl)
  if (waNum) {
    pesan = pesan.replace(`Regu      : ${regu?.nama}`, `Regu      : *${regu?.nama}* (@${waNum})`)
  }

  const msg = await waClient.sendMessage(ulp.wa_grup_id, pesan, { mentions })

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
    .select('nomor_tiket, wa_message_id, ulp_id, ulp(wa_grup_id), regu(nama, nomor_hp)')
    .eq('id', laporanId)
    .single()

  if (!laporan) return

  const ulp = normJoin(laporan.ulp as unknown as { wa_grup_id: string | null } | null)
  if (!ulp?.wa_grup_id) return

  const waClient = await getWaClientForUlp(laporan.ulp_id)
  if (!waClient) return

  const regu = normJoin(laporan.regu as unknown as { nama: string; nomor_hp?: string | null } | null)
  let pesan = buildPesanUpdateStatus(
    laporan.nomor_tiket,
    status,
    regu?.nama ?? '—',
    keterangan ?? null,
  )

  const waNum = formatWaNumber(regu?.nomor_hp)
  const mentions = waNum ? [`${waNum}@c.us`] : undefined

  if (waNum) {
    pesan = pesan.replace(`| ${regu?.nama}`, `| *${regu?.nama}* (@${waNum})`)
  }

  try {
    if (laporan.wa_message_id) {
      const originalMsg = await waClient.getMessageById(laporan.wa_message_id)
      if (originalMsg) {
        await originalMsg.reply(pesan)
      } else {
        await waClient.sendMessage(ulp.wa_grup_id, pesan, { mentions })
      }
    } else {
      await waClient.sendMessage(ulp.wa_grup_id, pesan, { mentions })
    }
  } catch {
    await waClient.sendMessage(ulp.wa_grup_id, pesan, { mentions })
  }
}
