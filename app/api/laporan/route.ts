import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLaporanSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'
import { kirimLaporanBaru } from '@/lib/wa/send'

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

  const { ulp_id, piket_id } = body as { ulp_id: string; piket_id: string | null }
  if (!ulp_id) return NextResponse.json({ data: null, error: 'ulp_id diperlukan' }, { status: 400 })

  const admin = createAdminClient()

  // Check nomor_tiket uniqueness per ULP
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
      piket_id: piket_id ?? null,
      regu_id: parsed.data.regu_id,
      nama_pelanggan: parsed.data.nama_pelanggan,
      nomor_pelanggan: parsed.data.nomor_pelanggan ?? null,
      lokasi: parsed.data.lokasi,
      keterangan: parsed.data.keterangan ?? null,
      status: 'lapor',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  // Log riwayat
  await admin.from('riwayat_status').insert({
    laporan_id: laporan.id,
    status_lama: 'lapor',
    status_baru: 'lapor',
    keterangan: parsed.data.keterangan ?? null,
    updated_by: UPDATED_BY.CC,
  })

  // Trigger WA notification (fire and forget)
  kirimLaporanBaru(laporan.id).catch(() => null)

  return NextResponse.json({ data: laporan, error: null }, { status: 201 })
}
