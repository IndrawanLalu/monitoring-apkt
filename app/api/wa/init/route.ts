import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateWaClient, isClientRegistered, markClientRegistered, destroyWaClient, isInitLocked, acquireInitLock, releaseInitLock } from '@/lib/wa/client'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()

  // Cegah concurrent init untuk user yang sama
  if (isInitLocked(userId)) {
    console.log(`[WA Init] LOCKED — already initializing user:${userId.slice(0, 8)}`)
    return NextResponse.json({ success: true, message: 'WhatsApp sedang dalam proses inisialisasi, harap tunggu.' })
  }
  acquireInitLock(userId)
  console.log(`[WA Init] lock acquired user:${userId.slice(0, 8)}`)

  const { error: upsertError } = await admin
    .from('wa_session')
    .upsert({ user_id: userId, status: 'loading' }, { onConflict: 'user_id' })
  if (upsertError) console.error('[WA Init] upsert error:', upsertError)

  await destroyWaClient(userId, 'init-route')

  // Fire-and-forget dengan auto-retry jika "browser already running"
  startWaSession(userId, admin, 1)

  return NextResponse.json({ success: true, message: 'WhatsApp client initializing...' })
}

async function startWaSession(
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
  attempt: number
) {
  const MAX_ATTEMPTS = 3
  console.log(`[WA Init] startWaSession attempt:${attempt}/${MAX_ATTEMPTS} user:${userId.slice(0, 8)}`)

  const client = getOrCreateWaClient(userId)

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
      releaseInitLock(userId)
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

      // Auto-reconnect saat frame WA Web detach (WA Web navigate/update sendiri)
      client.pupPage?.once('framedetached', () => {
        console.log(`[WA] frame detached — schedule reconnect user:${userId.slice(0, 8)}`)
        setTimeout(async () => {
          await destroyWaClient(userId, 'frame-detached')
          await admin
            .from('wa_session')
            .update({ status: 'loading', session_data: null })
            .eq('user_id', userId)
          startWaSession(userId, admin, 1)
        }, 3000)
      })
    })

    client.on('disconnected', async () => {
      releaseInitLock(userId)
      await destroyWaClient(userId)
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })

    client.on('auth_failure', async () => {
      releaseInitLock(userId)
      console.error(`[WA Auth Failure] user: ${userId}`)
      await destroyWaClient(userId)
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })
  }

  client.initialize().catch(async (err: any) => {
    const isBrowserRunning = String(err?.message).includes('browser is already running')

    if (isBrowserRunning && attempt < MAX_ATTEMPTS) {
      console.log(`[WA Init] "browser already running" — retry ${attempt}/${MAX_ATTEMPTS - 1} user:${userId.slice(0, 8)}`)
      await destroyWaClient(userId, `init-retry-${attempt}`)
      await new Promise((r) => setTimeout(r, 2000))
      return startWaSession(userId, admin, attempt + 1)
    }

    releaseInitLock(userId)
    console.error(`[WA Init Error] attempt:${attempt} user: ${userId}`, err)
    await destroyWaClient(userId, 'init-catch')
    await admin
      .from('wa_session')
      .update({ status: 'disconnected', session_data: null })
      .eq('user_id', userId)
  })
}
