import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp } from '@/lib/otorisasi'
import { z } from 'zod'
import { ringkasGalat } from '@/lib/log'

const schema = z.object({
  ulp_id: z.string().uuid(),
  nama: z.string().min(1).max(50),
  nomor_hp: z.string().max(20).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const izin = await requireUlp(parsed.data.ulp_id)
  if (izin.response) return izin.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('regu')
    .insert(parsed.data)
    .select('id, ulp_id, nama, nomor_hp, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Nama regu sudah ada' }, { status: 409 })
    console.error('[regu POST]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal membuat regu' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
