import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ccCallbackLaporanSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ccCallbackLaporanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 400 },
    )
  }

  const { ulp_id } = body as { ulp_id: string }
  if (!ulp_id) return NextResponse.json({ data: null, error: 'ulp_id diperlukan' }, { status: 400 })

  const admin = createAdminClient()

  // Ambil profil user untuk mendapatkan nama_cc_callback
  const { data: profile } = await admin
    .from('profiles')
    .select('nama')
    .eq('id', user.id)
    .single()

  const ccName = profile?.nama ?? null
  const now = new Date().toISOString()

  // Cek apakah laporan dengan nomor_tiket tersebut sudah ada
  const { data: existing } = await admin
    .from('laporan')
    .select('id, status, keterangan')
    .eq('ulp_id', ulp_id)
    .eq('nomor_tiket', parsed.data.nomor_tiket)
    .maybeSingle()

  let laporanId = ''
  let magicToken = ''
  let currentStatus = existing?.status ?? 'lapor'

  if (existing) {
    // UPDATE laporan yang sudah ada, tanpa mengubah status
    const { data: updated, error } = await admin
      .from('laporan')
      .update({
        nama_cc_callback: ccName,
        tanggal_callback: now,
        status_callback: parsed.data.status_callback ?? null,
      })
      .eq('id', existing.id)
      .select('id, nomor_tiket, status, magic_token')
      .single()

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

    laporanId = updated.id
    magicToken = updated.magic_token
    currentStatus = existing.status

    // Catat riwayat callback tanpa ubah status
    await admin.from('riwayat_status').insert({
      laporan_id: laporanId,
      status_lama: existing.status,
      status_baru: existing.status,
      keterangan: `Callback diinput oleh CC (${parsed.data.status_callback || 'Info'})`,
      updated_by: UPDATED_BY.CC,
    })

  } else {
    // INSERT laporan baru tanpa regu
    const newStatus = parsed.data.status ?? 'lapor'
    const { data: inserted, error } = await admin
      .from('laporan')
      .insert({
        nomor_tiket: parsed.data.nomor_tiket,
        ulp_id,
        piket_id: null,
        regu_id: null, // Boleh null karena sudah di-ALTER di DB
        nama_pelanggan: parsed.data.nama_pelanggan,
        nomor_pelanggan: parsed.data.nomor_pelanggan ?? null,
        lokasi: parsed.data.lokasi,
        keterangan: parsed.data.keterangan ?? null,
        status: newStatus,
        nama_cc_callback: ccName,
        tanggal_callback: now,
        status_callback: parsed.data.status_callback ?? null,
        ...(parsed.data.created_at ? {
          created_at: parsed.data.created_at,
          updated_at: parsed.data.created_at,
        } : {}),
      })
      .select('id, nomor_tiket, status, magic_token')
      .single()

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

    laporanId = inserted.id
    magicToken = inserted.magic_token
    currentStatus = newStatus

    await admin.from('riwayat_status').insert({
      laporan_id: laporanId,
      status_lama: newStatus,
      status_baru: newStatus,
      keterangan: parsed.data.keterangan ?? null,
      updated_by: UPDATED_BY.CC,
    })
  }

  return NextResponse.json({ 
    data: { id: laporanId, nomor_tiket: parsed.data.nomor_tiket, status: currentStatus, magic_token: magicToken }, 
    error: null 
  }, { status: 201 })
}
