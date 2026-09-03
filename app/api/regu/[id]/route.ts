import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBarisUlp } from '@/lib/otorisasi'
import { z } from 'zod'
import { ringkasGalat } from '@/lib/log'

const patchSchema = z.object({
  nama: z.string().min(1).max(50).optional(),
  nomor_hp: z.string().max(20).nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const izin = await requireBarisUlp('regu', id)
  if (izin.response) return izin.response

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('regu')
    .update(parsed.data)
    .eq('id', id)
    .select('id, ulp_id, nama, nomor_hp, created_at')
    .single()

  if (error) {
    console.error('[regu PATCH]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal menyimpan perubahan regu' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const izin = await requireBarisUlp('regu', id)
  if (izin.response) return izin.response

  const admin = createAdminClient()
  const { error } = await admin.from('regu').delete().eq('id', id)
  if (error) {
    console.error('[regu DELETE]', ringkasGalat(error))
    return NextResponse.json({ error: 'Gagal menghapus regu. Pastikan tidak ada laporan atau petugas yang masih terkait.' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
