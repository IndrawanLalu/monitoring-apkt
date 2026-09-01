import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UPDATED_BY } from '@/constants'
import { kirimUpdateStatus } from '@/lib/wa/send'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ulp_id, regu_id } = body as { ulp_id: string; regu_id: string }

  if (!ulp_id || !regu_id) {
    return NextResponse.json({ error: 'ulp_id dan regu_id diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: laporan, error: fetchErr } = await admin
    .from('laporan')
    .select('id, nomor_tiket, ulp_id, regu_id, piket_id, status, keterangan')
    .eq('id', id)
    .single()

  if (fetchErr || !laporan) {
    return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
  }

  const pindahUlp = laporan.ulp_id !== ulp_id

  const updatePayload: Record<string, unknown> = {
    ulp_id,
    regu_id,
    updated_at: new Date().toISOString(),
  }

  // Jika pindah ULP berbeda: clear piket dan wa_message agar tidak orphan
  if (pindahUlp) {
    updatePayload.piket_id = null
    updatePayload.wa_message_id = null
  }

  const { data: updated, error: updateErr } = await admin
    .from('laporan')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Audit trail
  const { data: regu } = await admin.from('regu').select('nama').eq('id', regu_id).single()
  const { data: ulp } = await admin.from('ulp').select('nama').eq('id', ulp_id).single()

  await admin.from('riwayat_status').insert({
    laporan_id: id,
    status_lama: laporan.status,
    status_baru: laporan.status,
    keterangan: `Dipindahkan ke ${ulp?.nama ?? ulp_id} — ${regu?.nama ?? regu_id}`,
    updated_by: UPDATED_BY.CC,
  })

  // WA notif ke grup ULP baru jika pindah ULP
  if (pindahUlp) {
    kirimUpdateStatus(id, laporan.status as never, `Dipindahkan ke ${ulp?.nama ?? ulp_id}`).catch((e) => console.error("[WA] gagal kirim notif pindah ULP:", e))
  }

  return NextResponse.json({ data: updated, error: null })
}
