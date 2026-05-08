import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { destroyWaClient } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  destroyWaClient(userId)

  const admin = createAdminClient()
  await admin
    .from('wa_session')
    .update({ status: 'disconnected', session_data: null })
    .eq('user_id', userId)

  return NextResponse.json({ success: true })
}
