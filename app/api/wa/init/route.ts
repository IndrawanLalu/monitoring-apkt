import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { destroyWaClient, isInitLocked, acquireInitLock } from '@/lib/wa/client'
import { startWaSession } from '@/lib/wa/session'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()

  // Cegah concurrent init untuk user yang sama
  if (isInitLocked(userId)) {
    console.log(`[WA Init] LOCKED — already initializing user:${userId.slice(0, 8)}`)
    return NextResponse.json({ success: true, message: 'WhatsApp sedang dalam proses inisialisasi, harap tunggu.' })
  }
  acquireInitLock(userId)
  console.log(`[WA Init] lock acquired user:${userId.slice(0, 8)}`)

  const { error: upsertError } = await admin
    .from('wa_session')
    .upsert({ user_id: userId, status: 'loading' }, { onConflict: 'user_id' })
  if (upsertError) console.error('[WA Init] upsert error:', upsertError)

  await destroyWaClient(userId, 'init-route')

  // Fire-and-forget dengan auto-retry jika "browser already running"
  startWaSession(userId, admin, 1)

  return NextResponse.json({ success: true, message: 'WhatsApp client initializing...' })
}
