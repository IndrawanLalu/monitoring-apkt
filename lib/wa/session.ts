import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getOrCreateWaClient,
  isClientRegistered,
  markClientRegistered,
  destroyWaClient,
  releaseInitLock,
} from './client'

export async function startWaSession(
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
  attempt: number,
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

      // Auto-reconnect saat frame WA Web detach (WA Web navigate/update sendiri)
      // keepSession: true — jangan hapus folder session agar reconnect tidak perlu QR ulang
      client.pupPage?.once('framedetached', () => {
        console.log(`[WA] frame detached — schedule reconnect user:${userId.slice(0, 8)}`)
        setTimeout(async () => {
          await destroyWaClient(userId, 'frame-detached', { keepSession: true })
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
      await destroyWaClient(userId, 'disconnected')
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })

    client.on('auth_failure', async () => {
      releaseInitLock(userId)
      console.error(`[WA Auth Failure] user:${userId}`)
      await destroyWaClient(userId, 'auth_failure')
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', userId)
    })
  }

  client.initialize().catch(async (err: unknown) => {
    const isBrowserRunning = String((err as Error)?.message).includes('browser is already running')

    if (isBrowserRunning && attempt < MAX_ATTEMPTS) {
      console.log(`[WA Init] "browser already running" — retry ${attempt}/${MAX_ATTEMPTS - 1} user:${userId.slice(0, 8)}`)
      // keepSession: true — hanya kill Chrome, folder session dipertahankan
      await destroyWaClient(userId, `init-retry-${attempt}`, { keepSession: true })
      await new Promise((r) => setTimeout(r, 2000))
      return startWaSession(userId, admin, attempt + 1)
    }

    releaseInitLock(userId)
    console.error(`[WA Init Error] attempt:${attempt} user:${userId}`, err)
    await destroyWaClient(userId, 'init-catch')
    await admin
      .from('wa_session')
      .update({ status: 'disconnected', session_data: null })
      .eq('user_id', userId)
  })
}
