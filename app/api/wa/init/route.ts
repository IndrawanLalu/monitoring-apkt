import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { destroyWaClient, isInitLocked, acquireInitLock } from '@/lib/wa/client'
import { startWaSession } from '@/lib/wa/session'
import { gatewayEnabled, gatewayStartSession, waOffline, GatewayUnreachableError } from '@/lib/wa/gateway'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()

  // --- Jalur BARU: gateway (Baileys) ---
  if (gatewayEnabled()) {
    if (waOffline()) {
      return NextResponse.json({
        error: 'Mode WA_OFFLINE aktif — koneksi WhatsApp dimatikan untuk pengembangan lokal. Pesan yang mestinya terkirim dicetak di terminal.',
      }, { status: 503 })
    }

    try {
      await gatewayStartSession(userId)
    } catch (err) {
      // Jangan tulis status 'loading' kalau gateway-nya sendiri tak terjangkau —
      // itu meninggalkan baris menggantung yang tak akan pernah jadi 'connected'.
      const pesan = err instanceof GatewayUnreachableError
        ? `${err.message}. Kalau ini di laptop lokal: gateway berjalan di VPS, bukan di sini.`
        : err instanceof Error ? err.message : 'Gagal memulai sesi di gateway'
      return NextResponse.json({ error: pesan }, { status: 502 })
    }

    await admin.from('wa_session').upsert({ user_id: userId, status: 'loading', session_data: null }, { onConflict: 'user_id' })
    return NextResponse.json({ success: true, message: 'WhatsApp session dimulai di gateway...' })
  }

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
