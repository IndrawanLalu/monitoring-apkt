import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('id, nomor_tiket, nama_pelanggan, lokasi, regu_id, status')
    .eq('magic_token', token)
    .single()

  if (!laporan) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  const reguId = laporan.regu_id as string

  // Cek apakah survey sudah diisi
  const [{ data: reguData }, { data: antrian }, { data: surveyData }] = await Promise.all([
    admin
      .from('regu')
      .select('id, nama, ulp(id, nama)')
      .eq('id', reguId)
      .single(),
    admin
      .from('laporan')
      .select('id, status, created_at')
      .eq('regu_id', reguId)
      .neq('status', 'selesai')
      .order('created_at', { ascending: true }),
    admin
      .from('survey_laporan')
      .select('id')
      .eq('laporan_id', laporan.id)
      .maybeSingle(),
  ])

  const regu = reguData as unknown as { id: string; nama: string; ulp: { id: string; nama: string } | null } | null
  const reguNama = regu?.nama ?? '—'
  const ulpNama = (regu?.ulp as { nama: string } | null)?.nama ?? '—'

  const isSelesai = laporan.status === 'selesai'
  const surveyDone = !!surveyData

  const queue = (antrian ?? []).map((item, idx) => ({
    position: idx + 1,
    isOwn: (item.id as string) === (laporan.id as string),
    status: item.status as string,
  }))

  const myPosition = queue.find((q) => q.isOwn)?.position ?? 0

  return NextResponse.json({
    found: true,
    reguNama,
    ulpNama,
    myStatus: laporan.status as string,
    myNomor: laporan.nomor_tiket as string,
    namaPelanggan: laporan.nama_pelanggan as string,
    alamat: laporan.lokasi as string,
    isSelesai,
    surveyDone,
    myPosition: isSelesai ? 0 : myPosition,
    totalAntrian: isSelesai ? 0 : queue.length,
    queue: isSelesai ? [] : queue,
  })
}
