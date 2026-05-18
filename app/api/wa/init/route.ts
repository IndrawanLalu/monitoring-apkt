import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateWaClient, getWaClient, isClientRegistered, markClientRegistered, destroyWaClient } from '@/lib/wa/client'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()
  const { error: upsertError } = await admin.from('wa_session').upsert({ user_id: userId, status: 'loading' }, { onConflict: 'user_id' })
  if (upsertError) console.error('[WA Init] upsert error:', upsertError)
  else console.log('[WA Init] upsert ok, userId:', userId)

  console.log(`[WA Init] PRE-DESTROY inMap:${!!getWaClient(userId)} registered:${isClientRegistered(userId)} userId:${userId.slice(0,8)}`)
  await destroyWaClient(userId, 'init-route')
  console.log(`[WA Init] POST-DESTROY inMap:${!!getWaClient(userId)} registered:${isClientRegistered(userId)}`)

  const client = getOrCreateWaClient(userId)
  console.log(`[WA Init] client created, calling initialize...`)

  if (!isClientRegistered(userId)) {
    markClientRegistered(userId)

    client.on('qr', async (qr) => {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
      await admin
        .from('wa_session')
        .update({ status: 'scanning', session_data: { qr: qrDataUrl } })
        .eq('user_id', userId)
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
      await destroyWaClient(userId)
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })

    client.on('auth_failure', async () => {
      console.error(`[WA Auth Failure] user: ${userId}`)
      await destroyWaClient(userId)
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })
  }

  // Initialize async without blocking, but catch error
  client.initialize().catch(async (err) => {
    console.error(`[WA Init Error] user: ${userId}`, err)
    await destroyWaClient(userId, 'init-catch')
    await admin
      .from('wa_session')
      .update({ status: 'disconnected', session_data: null })
      .eq('user_id', userId)
  })

  return NextResponse.json({ success: true, message: 'WhatsApp client initializing...' })
}
