import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id } = await req.json()
  if (!ulp_id) return NextResponse.json({ error: 'ulp_id diperlukan' }, { status: 400 })

  // Verifikasi user punya akses ke ULP ini
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_ulp')
    .select('id')
    .eq('user_id', user.id)
    .eq('ulp_id', ulp_id)
    .single()

  if (!data) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  const res = NextResponse.json({ success: true })
  res.cookies.set('active_ulp_id', ulp_id, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 hari
  })
  return res
}
