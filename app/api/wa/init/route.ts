import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatewayEnabled, gatewayStartSession, waOffline, GatewayUnreachableError, resetCacheSesi } from '@/lib/wa/gateway'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const admin = createAdminClient()

  if (!gatewayEnabled()) {
    return NextResponse.json({ error: 'wa-gateway belum dikonfigurasi (WA_USE_GATEWAY / WA_GATEWAY_URL / WA_GATEWAY_KEY).' }, { status: 503 })
  }

  if (waOffline()) {
    return NextResponse.json({
      error: 'Mode WA_OFFLINE aktif — koneksi WhatsApp dimatikan untuk pengembangan lokal. Pesan yang mestinya terkirim dicetak di terminal.',
    }, { status: 503 })
  }

  try {
    await gatewayStartSession(userId)
    resetCacheSesi()
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
