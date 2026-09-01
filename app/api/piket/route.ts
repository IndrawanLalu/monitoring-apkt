import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUlp } from '@/lib/otorisasi'
import { z } from 'zod'

const createPiketSchema = z.object({
  ulp_id: z.string().uuid(),
  shift_type_id: z.string().uuid(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nama_cc: z.string().min(1, 'Nama CC wajib diisi').max(100),
  petugas_assignments: z.array(z.object({
    regu_id: z.string().uuid(),
    petugas_ids: z.array(z.string().uuid()),
  })).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createPiketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const izin = await requireUlp(parsed.data.ulp_id)
  if (izin.response) return izin.response

  const { petugas_assignments, ...piketData } = parsed.data
  const admin = createAdminClient()

  // Cek piket hari ini sudah ada (ulp + shift + tanggal)
  const { data: todayPiket } = await admin
    .from('piket')
    .select('id')
    .eq('ulp_id', piketData.ulp_id)
    .eq('shift_type_id', piketData.shift_type_id)
    .eq('tanggal', piketData.tanggal)
    .maybeSingle()

  if (todayPiket) {
    return NextResponse.json({ data: null, error: 'Piket shift ini sudah ada untuk tanggal tersebut' }, { status: 409 })
  }

  // Cek piket terbaru untuk ulp + shift (beda tanggal)
  const { data: latestPiket } = await admin
    .from('piket')
    .select('id, nama_cc, piket_petugas(regu_id, petugas_id)')
    .eq('ulp_id', piketData.ulp_id)
    .eq('shift_type_id', piketData.shift_type_id)
    .order('tanggal', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestPiket) {
    // Bandingkan config: nama_cc + set petugas assignments
    const incomingSet = new Set(
      (petugas_assignments ?? []).flatMap(({ regu_id, petugas_ids }) =>
        petugas_ids.map(pid => `${regu_id}:${pid}`)
      )
    )
    const existingSet = new Set(
      (latestPiket.piket_petugas as { regu_id: string; petugas_id: string }[]).map(
        pp => `${pp.regu_id}:${pp.petugas_id}`
      )
    )
    const isSameConfig =
      latestPiket.nama_cc === piketData.nama_cc &&
      incomingSet.size === existingSet.size &&
      [...incomingSet].every(k => existingSet.has(k))

    if (isSameConfig) {
      // Config identik: cukup update tanggal ke hari ini
      const { data: updated } = await admin
        .from('piket')
        .update({ tanggal: piketData.tanggal })
        .eq('id', latestPiket.id)
        .select('id, tanggal, ulp_id, shift_type_id, nama_cc, created_at, shift_type(id, nama, jam_mulai, jam_selesai)')
        .single()

      return NextResponse.json({ data: updated, error: null }, { status: 200 })
    }
  }

  // Config berbeda atau belum ada piket: buat record baru
  const { data: piket, error } = await admin
    .from('piket')
    .insert({ ...piketData })
    .select('id, tanggal, ulp_id, shift_type_id, nama_cc, created_at, shift_type(id, nama, jam_mulai, jam_selesai)')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Piket shift ini sudah ada untuk tanggal tersebut' : error.message
    return NextResponse.json({ data: null, error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }

  if (petugas_assignments?.length) {
    const rows = petugas_assignments.flatMap(({ regu_id, petugas_ids }) =>
      petugas_ids.map((petugas_id) => ({ piket_id: piket.id, regu_id, petugas_id }))
    )
    if (rows.length) await admin.from('piket_petugas').insert(rows)
  }

  return NextResponse.json({ data: piket, error: null }, { status: 201 })
}
