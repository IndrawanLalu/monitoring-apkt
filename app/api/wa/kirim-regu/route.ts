import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getWaClient } from '@/lib/wa/client'
import { buildPesanLaporanRegu } from '@/lib/wa/messages'
import { SHIFT_JAM } from '@/constants'
import type { ShiftType } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { regu_id, ulp_id, piket_id } = await req.json()
  if (!regu_id || !ulp_id) return NextResponse.json({ error: 'regu_id dan ulp_id diperlukan' }, { status: 400 })

  const admin = createAdminClient()

  const [{ data: regu }, { data: ulp }, { data: laporanAktif }] = await Promise.all([
    admin.from('regu').select('id, nama').eq('id', regu_id).single(),
    admin.from('ulp').select('wa_grup_id').eq('id', ulp_id).single(),
    admin
      .from('laporan')
      .select('nomor_tiket, nama_pelanggan, lokasi, status, keterangan')
      .eq('regu_id', regu_id)
      .neq('status', 'selesai')
      .order('created_at', { ascending: true }),
  ])

  if (!regu || !ulp?.wa_grup_id) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

  // Ambil petugas dari piket_petugas jika ada piket_id, fallback ke petugas_apkt
  let petugasList: { nama: string }[] = []
  if (piket_id) {
    const { data: pp } = await admin
      .from('piket_petugas')
      .select('petugas:petugas_apkt(nama)')
      .eq('piket_id', piket_id)
      .eq('regu_id', regu_id)
    petugasList = (pp ?? []).map((row) => ({ nama: (row.petugas as unknown as { nama: string }).nama }))
  }
  if (!petugasList.length) {
    const { data: fallback } = await admin.from('petugas_apkt').select('nama').eq('regu_id', regu_id)
    petugasList = fallback ?? []
  }

  const now = new Date()
  const jam = now.getHours()
  const shiftNama: ShiftType = jam >= 8 && jam < 16 ? 'pagi' : jam >= 16 ? 'sore' : 'malam'
  const shiftJam = SHIFT_JAM[shiftNama]

  const pesan = buildPesanLaporanRegu(regu, petugasList, laporanAktif ?? [], shiftNama, shiftJam, now)

  const waClient = getWaClient(user.id)
  if (!waClient) return NextResponse.json({ error: 'WhatsApp belum terhubung' }, { status: 503 })

  await waClient.sendMessage(ulp.wa_grup_id, pesan)

  return NextResponse.json({ success: true })
}
