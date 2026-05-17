export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { createAdminClient } = await import('./lib/supabase/admin')
  const { getOrCreateWaClient, isClientRegistered, markClientRegistered, destroyWaClient, hasWaSession } = await import('./lib/wa/client')

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
    markClientRegistered(user_id)

    const client = getOrCreateWaClient(user_id)

    client.on('ready', async () => {
      const info = client.info
      await admin
        .from('wa_session')
        .update({ status: 'connected', session_data: { wa_number: info?.wid?.user } })
        .eq('user_id', user_id)

      await new Promise((r) => setTimeout(r, 5000))
      try {
        const chats = await client.getChats()
        const groups = chats
          .filter((c) => c.isGroup)
          .map((c) => ({ nama: c.name, id: c.id._serialized }))
        await admin
          .from('wa_session')
          .update({ session_data: { wa_number: info?.wid?.user, groups } })
          .eq('user_id', user_id)
      } catch (err) {
        console.error('[WA getChats error]', err)
      }
    })

    client.on('disconnected', async () => {
      await admin
        .from('wa_session')
        .update({ status: 'disconnected', session_data: null })
        .eq('user_id', user_id)
    })

    client.initialize().catch(async (err) => {
      console.error(`[WA] Auto-reconnect error user ${user_id}:`, err)
      await destroyWaClient(user_id)
      await admin.from('wa_session').update({ status: 'disconnected', session_data: null }).eq('user_id', user_id)
    })
  }
}
