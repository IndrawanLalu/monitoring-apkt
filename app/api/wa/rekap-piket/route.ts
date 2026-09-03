import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp } from '@/lib/otorisasi'
import { kirimTeksKeGrupUlp, jamWita } from '@/lib/wa/send'
import { cariPiketAktif } from '@/lib/piket'
import { buildPesanRekapPiket } from '@/lib/wa/messages'
import { SHIFT_JAM } from '@/constants'
import type { ShiftType } from '@/types'
import { ringkasGalat } from '@/lib/log'

export async function POST(req: NextRequest) {
  const { ulp_id, piket_id } = await req.json()
  if (!ulp_id) return NextResponse.json({ error: 'ulp_id diperlukan' }, { status: 400 })

  const izin = await requireUlp(ulp_id)
  if (izin.response) return izin.response

  const admin = createAdminClient()

  const { data: ulp } = await admin.from('ulp').select('nama, wa_grup_id').eq('id', ulp_id).single()
  if (!ulp?.wa_grup_id) return NextResponse.json({ error: 'Grup WA belum dikonfigurasi' }, { status: 400 })

  const now = new Date()

  // Piket yang jadi acuan rekap: yang dikirim klien, kalau tidak ada cari yang aktif.
  const aktif = await cariPiketAktif(admin, ulp_id, now)
  const piketId: string | null = piket_id ?? aktif?.id ?? null

  if (!piketId) {
    return NextResponse.json(
      { error: 'Tidak ada piket aktif untuk ULP ini saat ini, jadi rekap serah terima tidak bisa dibatasi ke satu sesi.' },
      { status: 400 },
    )
  }

  const [{ data: reguList }, { data: piketPetugasRaw }, { data: selesaiList }, { data: belumList }, { data: piket }] =
    await Promise.all([
      admin.from('regu').select('id, nama').eq('ulp_id', ulp_id).order('nama'),
      admin.from('piket_petugas').select('regu_id, petugas:petugas_apkt(id, nama)').eq('piket_id', piketId),
      // Selesai: HANYA yang diselesaikan piket ini. `laporan.piket_id` tidak bisa
      // dipakai — NULL di seluruh baris database.
      admin.from('laporan').select('regu_id').eq('resolved_piket_id', piketId),
      // Belum selesai: kondisi saat ini, inilah yang diserahterimakan ke shift berikutnya.
      admin
        .from('laporan')
        .select('regu_id, nomor_tiket, nama_pelanggan, lokasi, keterangan, status, created_at')
        .eq('ulp_id', ulp_id)
        .neq('status', 'selesai')
        .order('created_at', { ascending: true }),
      admin.from('piket').select('nama_cc').eq('id', piketId).maybeSingle(),
    ])

  const shiftNama: ShiftType = aktif?.nama
    ?? (() => {
      const jam = jamWita(now)
      return jam >= 8 && jam < 16 ? 'pagi' : jam >= 16 ? 'sore' : 'malam'
    })()
  const shiftJam = aktif
    ? { mulai: aktif.jamMulai.slice(0, 5), selesai: aktif.jamSelesai.slice(0, 5) }
    : SHIFT_JAM[shiftNama]

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
    selesaiList ?? [],
    (belumList ?? []) as never,
    shiftNama,
    shiftJam,
    now,
    piket?.nama_cc ?? null,
  )

  try {
    await kirimTeksKeGrupUlp(ulp_id, ulp.wa_grup_id, pesan)
  } catch (e) {
    console.error('[WA] gagal kirim rekap piket:', ringkasGalat(e))
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}
