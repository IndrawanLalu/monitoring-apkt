import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
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

  const body = await req.json()
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
  } = body

  // Validasi field wajib
  const required = { kondisi_setelah, kualitas_pelayanan, kecepatan_respon, ada_pungli, ada_tips, ada_3s, ada_identitas, ada_apd, ada_hal_tidak_senang, kepuasan_keseluruhan }
  for (const [k, v] of Object.entries(required)) {
    if (!v) return NextResponse.json({ error: `Field ${k} wajib diisi` }, { status: 400 })
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
