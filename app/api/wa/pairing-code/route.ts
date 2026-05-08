import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateWaClient, isClientRegistered, markClientRegistered } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const { phone_number } = await req.json()
  if (!phone_number) {
    return NextResponse.json({ error: 'phone_number diperlukan' }, { status: 400 })
  }

  const cleanPhone = phone_number.replace(/\D/g, '').replace(/^0/, '62')

  const admin = createAdminClient()
  await admin.from('wa_session').upsert({ user_id: userId, status: 'loading' }, { onConflict: 'user_id' })

  const client = getOrCreateWaClient(userId)

  if (!isClientRegistered(userId)) {
    markClientRegistered(userId)

    client.on('qr', async () => {
      try {
        const code = await client.requestPairingCode(cleanPhone)
        await admin
          .from('wa_session')
          .update({ status: 'scanning', session_data: { pairing_code: code } })
          .eq('user_id', userId)
      } catch (err) {
        console.error('[WA pairing-code error]', err)
        await admin
          .from('wa_session')
          .update({ status: 'disconnected', session_data: null })
          .eq('user_id', userId)
      }
    })

    client.on('ready', async () => {
      const info = client.info

      await admin
        .from('wa_session')
        .update({ status: 'connected', session_data: { wa_number: info?.wid?.user } })
        .eq('user_id', userId)

      await new Promise((r) => setTimeout(r, 5000))
      try {
        const chats = await client.getChats()
        const groups = chats
          .filter((c) => c.isGroup)
          .map((c) => ({ nama: c.name, id: c.id._serialized }))
        await admin
          .from('wa_session')
          .update({ session_data: { wa_number: info?.wid?.user, groups } })
          .eq('user_id', userId)
      } catch (err) {
        console.error('[WA getChats error]', err)
      }
    })

    client.on('disconnected', async () => {
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })

    client.initialize()
  }

  return NextResponse.json({ success: true })
}
