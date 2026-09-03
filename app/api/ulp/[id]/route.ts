import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp } from '@/lib/otorisasi'
import { z } from 'zod'
import { ringkasGalat } from '@/lib/log'

const patchSchema = z.object({
  wa_grup_id: z.string().nullable().optional(),
  nama: z.string().min(1).max(100).optional(),
  wa_template_callback: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Tanpa ini, siapa pun yang login bisa mengubah wa_grup_id ULP mana pun —
  // artinya membelokkan seluruh notifikasi gangguan ULP lain ke grup miliknya.
  const izin = await requireUlp(id)
  if (izin.response) return izin.response

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ulp')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[ulp PATCH]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal menyimpan perubahan ULP' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
