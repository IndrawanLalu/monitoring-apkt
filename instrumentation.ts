export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Mode gateway: koneksi WA dipegang wa-gateway (Baileys), tak ada whatsapp-web.js
  // yang perlu di-reconnect saat boot.
  const { gatewayEnabled } = await import('./lib/wa/gateway')
  if (gatewayEnabled()) {
    console.log('[WA] Mode gateway aktif — skip auto-reconnect whatsapp-web.js')
    return
  }

  const { createAdminClient } = await import('./lib/supabase/admin')
  const { isClientRegistered, destroyWaClient, hasWaSession } = await import('./lib/wa/client')
  const { startWaSession } = await import('./lib/wa/session')

  const admin = createAdminClient()

  const { data: sessions } = await admin
    .from('wa_session')
    .select('user_id')
    .eq('status', 'connected')

  for (const { user_id } of sessions ?? []) {
    if (isClientRegistered(user_id)) continue

    // Skip auto-reconnect jika session folder tidak ada (session sudah stale)
    if (!hasWaSession(user_id)) {
      console.log(`[WA] Auto-reconnect skipped user ${user_id}: session folder not found`)
      await admin.from('wa_session').update({ status: 'disconnected', session_data: null }).eq('user_id', user_id)
      continue
    }

    console.log(`[WA] Auto-reconnect user ${user_id}`)
    startWaSession(user_id, admin, 1)
  }
}
