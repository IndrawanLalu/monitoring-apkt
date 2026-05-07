export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { createAdminClient } = await import('./lib/supabase/admin')
  const { getOrCreateWaClient, isClientRegistered, markClientRegistered } = await import('./lib/wa/client')

  const admin = createAdminClient()

  const { data: sessions } = await admin
    .from('wa_session')
    .select('ulp_id')
    .eq('status', 'connected')

  for (const { ulp_id } of sessions ?? []) {
    if (isClientRegistered(ulp_id)) continue

    console.log(`[WA] Auto-reconnect ULP ${ulp_id}`)
    markClientRegistered(ulp_id)

    const client = getOrCreateWaClient(ulp_id)

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

    client.initialize().catch((err) => {
      console.error(`[WA] Auto-reconnect error ULP ${ulp_id}:`, err)
    })
  }
}
