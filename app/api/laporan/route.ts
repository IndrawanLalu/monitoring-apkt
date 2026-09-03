import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp, reguMilikUlp } from '@/lib/otorisasi'
import { createLaporanSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'
import { kirimLaporanBaru } from '@/lib/wa/send'
import { ringkasGalat } from '@/lib/log'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createLaporanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 },
    )
  }

  const { ulp_id, piket_id } = body as { ulp_id: string; piket_id: string | null }

  // ulp_id datang dari klien dan sebelumnya dipakai apa adanya — operator ULP
  // mana pun bisa menyuntikkan laporan ke ULP lain.
  const izin = await requireUlp(ulp_id)
  if (izin.response) return izin.response

  // Regu harus benar-benar milik ULP tersebut, bukan regu ULP lain.
  if (!(await reguMilikUlp(parsed.data.regu_id, ulp_id))) {
    return NextResponse.json({ data: null, error: 'Regu tidak ada di ULP tersebut' }, { status: 400 })
  }

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
      status: parsed.data.status ?? 'lapor',
      ...(parsed.data.created_at ? {
        created_at: parsed.data.created_at,
        updated_at: parsed.data.created_at,
      } : {}),
    })
    .select('*')
    .single()

  if (error) {
    console.error('[laporan POST]', ringkasGalat(error))
    return NextResponse.json({ data: null, error: 'Gagal menyimpan laporan' }, { status: 500 })
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
  kirimLaporanBaru(laporan.id).catch((e) => console.error("[WA] gagal kirim laporan baru:", ringkasGalat(e)))

  return NextResponse.json({ data: laporan, error: null }, { status: 201 })
}
