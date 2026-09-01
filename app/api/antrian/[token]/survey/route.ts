import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { surveySchema } from '@/lib/validations/laporan'
import { rateLimit, ipPemanggil } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Endpoint publik tanpa sesi — batasi agar tidak bisa dibanjiri.
  const batas = rateLimit(`survey:${ipPemanggil(req.headers)}`, 10, 10 * 60_000)
  if (!batas.lolos) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan, coba lagi nanti.' }, {
      status: 429, headers: { 'Retry-After': String(batas.cobaLagiDetik) },
    })
  }

  const admin = createAdminClient()

  // Cari laporan berdasarkan token
  const { data: laporan } = await admin
    .from('laporan')
    .select('id, nomor_tiket, nama_pelanggan, lokasi, status')
    .eq('magic_token', token)
    .single()

  if (!laporan) {
    return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
  }

  if (laporan.status !== 'selesai') {
    return NextResponse.json({ error: 'Survey hanya bisa diisi setelah laporan selesai' }, { status: 400 })
  }

  // Cek apakah survey sudah pernah diisi
  const { data: existing } = await admin
    .from('survey_laporan')
    .select('id')
    .eq('laporan_id', laporan.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Survey sudah pernah diisi untuk laporan ini' }, { status: 409 })
  }

  const parsed = surveySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const {
    kondisi_setelah,
    kualitas_pelayanan,
    kecepatan_respon,
    ada_pungli,
    ada_tips,
    ada_3s,
    ada_identitas,
    ada_apd,
    ada_hal_tidak_senang,
    kepuasan_keseluruhan,
    pesan_saran,
  } = parsed.data

  const { error } = await admin.from('survey_laporan').insert({
    laporan_id:           laporan.id,
    nomor_tiket:          laporan.nomor_tiket,
    nama_pelanggan:       laporan.nama_pelanggan,
    alamat:               laporan.lokasi,
    kondisi_setelah,
    kualitas_pelayanan,
    kecepatan_respon,
    ada_pungli,
    ada_tips,
    ada_3s,
    ada_identitas,
    ada_apd,
    ada_hal_tidak_senang,
    kepuasan_keseluruhan,
    pesan_saran:          pesan_saran || null,
  })

  if (error) {
    console.error('[survey]', error)
    return NextResponse.json({ error: 'Gagal menyimpan survey' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
