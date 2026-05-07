import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateWaClient, isClientRegistered, markClientRegistered } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id, phone_number } = await req.json()
  if (!ulp_id || !phone_number) {
    return NextResponse.json({ error: 'ulp_id dan phone_number diperlukan' }, { status: 400 })
  }

  // Bersihkan nomor: hanya angka, pastikan diawali 62
  const cleanPhone = phone_number.replace(/\D/g, '').replace(/^0/, '62')

  const admin = createAdminClient()
  await admin.from('wa_session').upsert({ ulp_id, status: 'loading' }, { onConflict: 'ulp_id' })

  const client = getOrCreateWaClient(ulp_id)

  if (!isClientRegistered(ulp_id)) {
    markClientRegistered(ulp_id)

    client.on('qr', async () => {
      try {
        const code = await client.requestPairingCode(cleanPhone)
        await admin
          .from('wa_session')
          .update({ status: 'scanning', session_data: { pairing_code: code } })
          .eq('ulp_id', ulp_id)
      } catch (err) {
        console.error('[WA pairing-code error]', err)
        await admin
          .from('wa_session')
          .update({ status: 'disconnected', session_data: null })
          .eq('ulp_id', ulp_id)
      }
    })

    client.on('ready', async () => {
      const info = client.info

      await admin
        .from('wa_session')
        .update({ status: 'connected', session_data: { wa_number: info?.wid?.user } })
        .eq('ulp_id', ulp_id)

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

    client.initialize()
  }

  return NextResponse.json({ success: true })
}
