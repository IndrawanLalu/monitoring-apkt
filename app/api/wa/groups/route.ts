import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id } = await req.json()

  // Coba ambil langsung dari client aktif
  const client = getWaClient(ulp_id)
  if (client) {
    const chats = await client.getChats()
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => ({ nama: c.name, id: c.id._serialized }))
    return NextResponse.json({ data: groups })
  }

  // Fallback: baca dari session_data yang tersimpan di Supabase
  const admin = createAdminClient()
  const { data: session } = await admin
    .from('wa_session')
    .select('session_data')
    .eq('ulp_id', ulp_id)
    .single()

  const groups = (session?.session_data as { groups?: { nama: string; id: string }[] } | null)?.groups ?? []
  if (groups.length === 0) {
    return NextResponse.json({ error: 'Grup belum tersimpan. Reconnect WA terlebih dahulu.' }, { status: 503 })
  }

  return NextResponse.json({ data: groups })
}
