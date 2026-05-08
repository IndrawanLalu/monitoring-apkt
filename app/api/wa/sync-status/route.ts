import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()
  const client = getWaClient(userId)

  if (!client) {
    await admin
      .from('wa_session')
      .update({ status: 'disconnected', session_data: null })
      .eq('user_id', userId)
    return NextResponse.json({ status: 'disconnected' })
  }

  try {
    const info = client.info
    if (info?.wid?.user) {
      const chats = await client.getChats()
      const groups = chats
        .filter((c) => c.isGroup)
        .map((c) => ({ nama: c.name, id: c.id._serialized }))

      await admin
        .from('wa_session')
        .update({ status: 'connected', session_data: { wa_number: info.wid.user, groups } })
        .eq('user_id', userId)

      return NextResponse.json({ status: 'connected', wa_number: info.wid.user, groups_count: groups.length })
    }
  } catch {
    // client.info belum siap
  }

  return NextResponse.json({ status: 'loading' })
}
