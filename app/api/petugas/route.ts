import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp, reguMilikUlp } from '@/lib/otorisasi'
import { z } from 'zod'
import { ringkasGalat } from '@/lib/log'

const schema = z.object({
  ulp_id: z.string().uuid(),
  regu_id: z.string().uuid().nullable().optional(),
  nama: z.string().min(1).max(100),
  nomor_hp: z.string().max(20).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const izin = await requireUlp(parsed.data.ulp_id)
  if (izin.response) return izin.response

  // Cegah pasangan silang: petugas ULP A ditempel ke regu ULP B.
  if (parsed.data.regu_id && !(await reguMilikUlp(parsed.data.regu_id, parsed.data.ulp_id))) {
    return NextResponse.json({ error: 'Regu tidak ada di ULP tersebut' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('petugas_apkt')
    .insert(parsed.data)
    .select('id, ulp_id, regu_id, nama, nomor_hp, created_at')
    .single()

  if (error) {
    console.error('[petugas POST]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal menambah petugas' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
