import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatewayEnabled, gatewayRequestPairingCode } from '@/lib/wa/gateway'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const { phone_number } = await req.json()
  if (!phone_number) {
    return NextResponse.json({ error: 'phone_number diperlukan' }, { status: 400 })
  }

  const cleanPhone = phone_number.replace(/\D/g, '').replace(/^0/, '62')

  const admin = createAdminClient()

  if (!gatewayEnabled()) {
    return NextResponse.json({ error: 'wa-gateway belum dikonfigurasi.' }, { status: 503 })
  }

  await admin.from('wa_session').upsert({ user_id: userId, status: 'loading', session_data: null }, { onConflict: 'user_id' })
  try {
    const { code } = await gatewayRequestPairingCode(userId, cleanPhone)
    await admin.from('wa_session').update({ status: 'scanning', session_data: { pairing_code: code } }).eq('user_id', userId)
    return NextResponse.json({ success: true, code })
  } catch (e) {
    await admin.from('wa_session').update({ status: 'disconnected', session_data: null }).eq('user_id', userId)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
