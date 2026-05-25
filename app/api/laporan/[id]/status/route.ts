import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateStatusSchema } from '@/lib/validations/laporan'
import { UPDATED_BY } from '@/constants'
import { kirimUpdateStatus } from '@/lib/wa/send'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateStatusSchema.safeParse({ laporan_id: id, ...body })
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('laporan')
    .select('id, status, keterangan, ulp_id, regu_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ data: null, error: 'Laporan tidak ditemukan' }, { status: 404 })

  // Saat selesai: cari piket aktif + snapshot nama petugas regu
  let resolved_piket_id: string | null = null
  let resolved_petugas_names: string[] | null = null

  if (parsed.data.status === 'selesai') {
    const nowWita = new Date(Date.now() + 8 * 60 * 60 * 1000)
    const today = nowWita.toISOString().split('T')[0]
    const nowM = nowWita.getUTCHours() * 60 + nowWita.getUTCMinutes()

    const { data: todayPikets } = await admin
      .from('piket')
      .select('id, shift_type:shift_type(jam_mulai, jam_selesai)')
      .eq('ulp_id', existing.ulp_id)
      .eq('tanggal', today)

    const activePiket = (todayPikets ?? []).find(p => {
      const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
      const [mh, mm] = st.jam_mulai.split(':').map(Number)
      const [sh, sm] = st.jam_selesai.split(':').map(Number)
      const mulai = mh * 60 + (mm ?? 0)
      const selesai = sh * 60 + (sm ?? 0)
      return selesai > mulai ? nowM >= mulai && nowM < selesai : nowM >= mulai || nowM < selesai
    })

    resolved_piket_id = activePiket?.id ?? null

    // Snapshot nama petugas: dari piket_petugas jika ada piket aktif,
    // fallback ke semua petugas di regu
    if (existing.regu_id) {
      if (resolved_piket_id) {
        const { data: pp } = await admin
          .from('piket_petugas')
          .select('petugas:petugas_apkt(nama)')
          .eq('piket_id', resolved_piket_id)
          .eq('regu_id', existing.regu_id)
        const names = (pp ?? [])
          .map(r => (r.petugas as unknown as { nama: string } | null)?.nama)
          .filter((n): n is string => !!n)
        resolved_petugas_names = names.length > 0 ? names : null
      }

      // Fallback: ambil semua petugas di regu jika piket kosong
      if (!resolved_petugas_names) {
        const { data: rp } = await admin
          .from('petugas_apkt')
          .select('nama')
          .eq('regu_id', existing.regu_id)
        const names = (rp ?? []).map(r => r.nama as string).filter(Boolean)
        resolved_petugas_names = names.length > 0 ? names : null
      }
    }
  }

  const { data: laporan, error } = await admin
    .from('laporan')
    .update({
      status: parsed.data.status,
      keterangan: parsed.data.keterangan !== undefined ? parsed.data.keterangan : existing.keterangan,
      resolved_at: parsed.data.status === 'selesai' ? new Date().toISOString() : null,
      resolved_piket_id: parsed.data.status === 'selesai' ? resolved_piket_id : null,
      resolved_petugas_names: parsed.data.status === 'selesai' ? resolved_petugas_names : null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await admin.from('riwayat_status').insert({
    laporan_id: id,
    status_lama: existing.status,
    status_baru: parsed.data.status,
    keterangan: parsed.data.keterangan ?? null,
    updated_by: UPDATED_BY.CC,
  })

  // Trigger WA reply (fire and forget)
  kirimUpdateStatus(id, parsed.data.status, parsed.data.keterangan).catch(() => null)

  return NextResponse.json({ data: laporan, error: null })
}
