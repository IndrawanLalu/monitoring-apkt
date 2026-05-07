import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id } = await req.json()
  const admin = createAdminClient()
  const client = getWaClient(ulp_id)

  if (!client) {
    await admin
      .from('wa_session')
      .update({ status: 'disconnected', session_data: null })
      .eq('ulp_id', ulp_id)
    return NextResponse.json({ status: 'disconnected' })
  }

  try {
    const info = client.info
    if (info?.wid?.user) {
      // Client aktif dan authenticated
      const chats = await client.getChats()
      const groups = chats
        .filter((c) => c.isGroup)
        .map((c) => ({ nama: c.name, id: c.id._serialized }))

      await admin
        .from('wa_session')
        .update({ status: 'connected', session_data: { wa_number: info.wid.user, groups } })
        .eq('ulp_id', ulp_id)

      return NextResponse.json({ status: 'connected', wa_number: info.wid.user, groups_count: groups.length })
    }
  } catch {
    // client.info belum siap
  }

  return NextResponse.json({ status: 'loading' })
}
