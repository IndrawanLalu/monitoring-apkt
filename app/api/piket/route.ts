import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createPiketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { petugas_assignments, ...piketData } = parsed.data
  const admin = createAdminClient()

  const { data: piket, error } = await admin
    .from('piket')
    .insert({ ...piketData, nama_cc: piketData.nama_cc })
    .select('id, tanggal, ulp_id, shift_type_id, nama_cc, created_at, shift_type(id, nama, jam_mulai, jam_selesai)')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Piket shift ini sudah ada untuk tanggal tersebut' : error.message
    return NextResponse.json({ data: null, error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }

  // Insert petugas assignments
  if (petugas_assignments?.length) {
    const rows = petugas_assignments.flatMap(({ regu_id, petugas_ids }) =>
      petugas_ids.map((petugas_id) => ({ piket_id: piket.id, regu_id, petugas_id }))
    )
    if (rows.length) {
      await admin.from('piket_petugas').insert(rows)
    }
  }

  return NextResponse.json({ data: piket, error: null }, { status: 201 })
}
