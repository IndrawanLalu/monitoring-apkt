import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLaporanSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createLaporanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 },
    )
  }

  const { ulp_id } = body as { ulp_id: string }
  if (!ulp_id) return NextResponse.json({ data: null, error: 'ulp_id diperlukan' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('laporan')
    .select('id')
    .eq('ulp_id', ulp_id)
    .eq('nomor_tiket', parsed.data.nomor_tiket)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { data: null, error: `Nomor tiket ${parsed.data.nomor_tiket} sudah ada` },
      { status: 409 },
    )
  }

  const { data: laporan, error } = await admin
    .from('laporan')
    .insert({
      nomor_tiket: parsed.data.nomor_tiket,
      ulp_id,
      piket_id: null,
      regu_id: parsed.data.regu_id,
      nama_pelanggan: parsed.data.nama_pelanggan,
      nomor_pelanggan: parsed.data.nomor_pelanggan ?? null,
      lokasi: parsed.data.lokasi,
      keterangan: parsed.data.keterangan ?? null,
      status: parsed.data.status ?? 'lapor',
      ...(parsed.data.created_at ? {
        created_at: parsed.data.created_at,
        updated_at: parsed.data.created_at,
      } : {}),
    })
    .select('id, nomor_tiket, status, magic_token')
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  await admin.from('riwayat_status').insert({
    laporan_id: laporan.id,
    status_lama: parsed.data.status ?? 'lapor',
    status_baru: parsed.data.status ?? 'lapor',
    keterangan: parsed.data.keterangan ?? null,
    updated_by: UPDATED_BY.CC,
  })

  // Tidak ada kirimLaporanBaru — CC Callback buka WA manual ke pelanggan

  return NextResponse.json({ data: laporan, error: null }, { status: 201 })
}
