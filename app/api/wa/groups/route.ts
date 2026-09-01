import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatewayEnabled, gatewayListGroups, waOffline, GatewayUnreachableError } from '@/lib/wa/gateway'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

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

  return NextResponse.json({ error: 'wa-gateway belum dikonfigurasi.' }, { status: 503 })
}
