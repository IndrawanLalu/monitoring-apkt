import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getWaClient } from '@/lib/wa/client'
import { buildPesanRekapPiket } from '@/lib/wa/messages'
import { SHIFT_JAM } from '@/constants'
import type { ShiftType } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ulp_id, piket_id } = await req.json()
  if (!ulp_id) return NextResponse.json({ error: 'ulp_id diperlukan' }, { status: 400 })

  const admin = createAdminClient()

  const { data: ulp } = await admin.from('ulp').select('nama, wa_grup_id').eq('id', ulp_id).single()
  if (!ulp?.wa_grup_id) return NextResponse.json({ error: 'Grup WA belum dikonfigurasi' }, { status: 400 })

  const [{ data: reguList }, { data: piketPetugasRaw }, { data: laporanList }, { data: piket }] = await Promise.all([
    admin.from('regu').select('id, nama').eq('ulp_id', ulp_id).order('nama'),
    piket_id
      ? admin.from('piket_petugas').select('regu_id, petugas:petugas_apkt(id, nama)').eq('piket_id', piket_id)
      : Promise.resolve({ data: [] }),
    admin
      .from('laporan')
      .select('id, nomor_tiket, regu_id, nama_pelanggan, status, keterangan')
      .eq('ulp_id', ulp_id)
      .order('created_at', { ascending: true }),
    piket_id
      ? admin.from('piket').select('nama_cc').eq('id', piket_id).single()
      : Promise.resolve({ data: null }),
  ])

  const now = new Date()
  const jam = now.getHours()
  const shiftNama: ShiftType = jam >= 8 && jam < 16 ? 'pagi' : jam >= 16 ? 'sore' : 'malam'
  const shiftJam = SHIFT_JAM[shiftNama]

  // Bentuk petugasList dari piket_petugas untuk rekap
  const petugasList = (piketPetugasRaw ?? []).map((pp) => ({
    id: (pp.petugas as unknown as { id: string; nama: string }).id,
    regu_id: pp.regu_id,
    nama: (pp.petugas as unknown as { id: string; nama: string }).nama,
  }))

  const pesan = buildPesanRekapPiket(
    ulp.nama,
    reguList ?? [],
    petugasList,
    laporanList ?? [],
    shiftNama,
    shiftJam,
    now,
    piket?.nama_cc ?? null,
  )

  const waClient = getWaClient(user.id)
  if (!waClient) return NextResponse.json({ error: 'WhatsApp belum terhubung' }, { status: 503 })

  await waClient.sendMessage(ulp.wa_grup_id, pesan)

  return NextResponse.json({ success: true })
}
