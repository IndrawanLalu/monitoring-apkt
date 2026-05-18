import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  ulp_id: z.string().uuid(),
  regu_id: z.string().uuid().nullable().optional(),
  names: z.array(z.string().min(1).max(100)).min(1).max(500),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { ulp_id, regu_id, names } = parsed.data

  const rows = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((nama) => ({ ulp_id, regu_id: regu_id ?? null, nama }))

  if (rows.length === 0) return NextResponse.json({ error: 'Tidak ada nama yang valid' }, { status: 400 })

  const { data, error } = await admin
    .from('petugas_apkt')
    .insert(rows)
    .select('id, nama')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: data?.length ?? 0, names: data?.map((d) => d.nama) ?? [] })
}
