import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const client = getWaClient(userId)

  if (client) {
    try {
      const chats = await client.getChats()
      const groups = chats
        .filter((c) => c.isGroup)
        .map((c) => ({ nama: c.name, id: c.id._serialized }))
      return NextResponse.json({ data: groups })
    } catch (e) {
      console.error('[WA getChats] Error:', e)
      // Teruskan ke blok fallback di bawah jika gagal mengambil chat langsung dari client
    }
  }

  // Fallback: baca dari session_data yang tersimpan
  const admin = createAdminClient()
  const { data: session } = await admin
    .from('wa_session')
    .select('session_data')
    .eq('user_id', userId)
    .single()

  const groups = (session?.session_data as { groups?: { nama: string; id: string }[] } | null)?.groups ?? []
  if (groups.length === 0) {
    return NextResponse.json({ error: 'Grup belum tersimpan. Reconnect WA terlebih dahulu.' }, { status: 503 })
  }

  return NextResponse.json({ data: groups })
}
