import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateStatusSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'
import { kirimUpdateStatus } from '@/lib/wa/send'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateStatusSchema.safeParse({ laporan_id: id, ...body })
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('laporan')
    .select('id, status, keterangan, ulp_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ data: null, error: 'Laporan tidak ditemukan' }, { status: 404 })

  const { data: laporan, error } = await admin
    .from('laporan')
    .update({
      status: parsed.data.status,
      keterangan: parsed.data.keterangan !== undefined ? parsed.data.keterangan : existing.keterangan,
      resolved_at: parsed.data.status === 'selesai' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await admin.from('riwayat_status').insert({
    laporan_id: id,
    status_lama: existing.status,
    status_baru: parsed.data.status,
    keterangan: parsed.data.keterangan ?? null,
    updated_by: UPDATED_BY.CC,
  })

  // Trigger WA reply (fire and forget)
  kirimUpdateStatus(id, parsed.data.status, parsed.data.keterangan).catch(() => null)

  return NextResponse.json({ data: laporan, error: null })
}
