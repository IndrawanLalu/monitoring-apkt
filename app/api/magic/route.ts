import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { magicUpdateSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = magicUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('laporan')
    .select('id, status, keterangan')
    .eq('magic_token', parsed.data.token)
    .single()

  if (!existing) {
    return NextResponse.json({ data: null, error: 'Token tidak valid' }, { status: 404 })
  }

  if (existing.status === 'selesai') {
    return NextResponse.json({ data: null, error: 'Laporan sudah selesai' }, { status: 409 })
  }

  const { data: laporan, error } = await admin
    .from('laporan')
    .update({
      status: parsed.data.status,
      keterangan: parsed.data.keterangan !== undefined ? parsed.data.keterangan : existing.keterangan,
      resolved_at: parsed.data.status === 'selesai' ? new Date().toISOString() : null,
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await admin.from('riwayat_status').insert({
    laporan_id: existing.id,
    status_lama: existing.status,
    status_baru: parsed.data.status,
    keterangan: parsed.data.keterangan ?? null,
    updated_by: UPDATED_BY.PETUGAS,
  })

  // WA reply (fire and forget)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/wa/update-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      laporan_id: existing.id,
      status: parsed.data.status,
      keterangan: parsed.data.keterangan,
    }),
  }).catch(() => null)

  return NextResponse.json({ data: laporan, error: null })
}
