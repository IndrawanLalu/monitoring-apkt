import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'
import { gatewayEnabled, gatewayListGroups, waOffline, GatewayUnreachableError } from '@/lib/wa/gateway'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  // --- Jalur BARU: gateway (Baileys) ---
  if (gatewayEnabled()) {
    if (waOffline()) {
      return NextResponse.json({
        error: 'Mode WA_OFFLINE aktif. Daftar grup hanya bisa diambil dari gateway yang berjalan di VPS — set WA_OFFLINE=false dan buka SSH tunnel ke VPS kalau memang perlu memilih grup dari lokal.',
      }, { status: 503 })
    }
    try {
      const groups = await gatewayListGroups(userId)
      return NextResponse.json({ data: groups })
    } catch (e) {
      const pesan = e instanceof GatewayUnreachableError
        ? `${e.message}. Gateway berjalan di VPS — dari laptop lokal perlu SSH tunnel dulu.`
        : (e as Error).message
      return NextResponse.json({ error: pesan }, { status: 503 })
    }
  }

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
