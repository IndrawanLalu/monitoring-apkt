import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp, reguMilikUlp, peranPengelola } from '@/lib/otorisasi'
import { z } from 'zod'

const schema = z.object({
  ulp_id: z.string().uuid(),
  regu_id: z.string().uuid().nullable().optional(),
  names: z.array(z.string().min(1).max(100)).min(1).max(500),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { ulp_id, regu_id, names } = parsed.data

  const izin = await requireUlp(ulp_id)
  if (izin.response) return izin.response
  if (!peranPengelola(izin.profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (regu_id && !(await reguMilikUlp(regu_id, ulp_id))) {
    return NextResponse.json({ error: 'Regu tidak ada di ULP tersebut' }, { status: 400 })
  }

  const admin = createAdminClient()

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
