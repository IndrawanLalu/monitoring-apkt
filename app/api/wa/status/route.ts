import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatewayEnabled, gatewayGetSession, sessionIdForUser, mapGatewayToApkt } from '@/lib/wa/gateway'

// Status WA untuk user yang login. Di mode gateway → ambil dari gateway (Baileys)
// dan cerminkan ke tabel wa_session; di mode lama → baca wa_session langsung.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()

  if (gatewayEnabled()) {
    const s = await gatewayGetSession(sessionIdForUser(userId)).catch(() => null)
    const mapped = mapGatewayToApkt(s)
    await admin
      .from('wa_session')
      .upsert({ user_id: userId, status: mapped.status, session_data: mapped.session_data }, { onConflict: 'user_id' })
    return NextResponse.json({
      status: mapped.status,
      session_data: mapped.session_data,
      updated_at: new Date().toISOString(),
    })
  }

  const { data } = await admin
    .from('wa_session')
    .select('status, session_data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  return NextResponse.json(data ?? { status: 'disconnected', session_data: null, updated_at: null })
}
