import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { destroyWaClient } from '@/lib/wa/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id } = await req.json()
  if (!ulp_id) return NextResponse.json({ error: 'ulp_id diperlukan' }, { status: 400 })

  destroyWaClient(ulp_id)

  const admin = createAdminClient()
  await admin
    .from('wa_session')
    .update({ status: 'disconnected', session_data: null })
    .eq('ulp_id', ulp_id)

  return NextResponse.json({ success: true })
}
