import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateWaClient, isClientRegistered, markClientRegistered } from '@/lib/wa/client'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id } = await req.json()
  if (!ulp_id) return NextResponse.json({ error: 'ulp_id diperlukan' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('wa_session').upsert({ ulp_id, status: 'loading' }, { onConflict: 'ulp_id' })

  const client = getOrCreateWaClient(ulp_id)

  // Daftarkan event handler hanya sekali per ulp_id
  if (!isClientRegistered(ulp_id)) {
    markClientRegistered(ulp_id)

    client.on('qr', async (qr) => {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
      await admin
        .from('wa_session')
        .update({ status: 'scanning', session_data: { qr: qrDataUrl } })
        .eq('ulp_id', ulp_id)
    })

    client.on('ready', async () => {
      const info = client.info

      // Tandai connected dulu agar frontend langsung update
      await admin
        .from('wa_session')
        .update({ status: 'connected', session_data: { wa_number: info?.wid?.user } })
        .eq('ulp_id', ulp_id)

      // Delay lalu ambil grup (beri waktu WA load penuh)
      await new Promise((r) => setTimeout(r, 5000))
      try {
        const chats = await client.getChats()
        const groups = chats
          .filter((c) => c.isGroup)
          .map((c) => ({ nama: c.name, id: c.id._serialized }))
        await admin
          .from('wa_session')
          .update({ session_data: { wa_number: info?.wid?.user, groups } })
          .eq('ulp_id', ulp_id)
      } catch (err) {
        console.error('[WA getChats error]', err)
      }
    })

    client.on('disconnected', async () => {
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('ulp_id', ulp_id)
    })
  }

  // Selalu initialize agar tombol "Hubungkan Kembali" bisa reconnect
  client.initialize()

  return NextResponse.json({ success: true, message: 'WhatsApp client initializing...' })
}
