import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { LaporanClient } from './laporan-client'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; shift_id?: string; regu_id?: string }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const { tanggal: tanggalParam, shift_id: selectedShiftId, regu_id: selectedReguId } = await searchParams

  // Tanggal default: hari ini dalam WITA (UTC+8)
  const selectedDate = tanggalParam ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  if (!profile.activeUlp) redirect('/settings')
  const supabase = await createClient()
  const ulpId = profile.activeUlp!.id

  const [{ data: reguList }, { data: shiftTypes }] = await Promise.all([
    supabase.from('regu').select('id, nama').eq('ulp_id', ulpId).order('nama'),
    supabase.from('shift_type').select('id, nama').order('nama'),
  ])

  let query = supabase
    .from('laporan')
    .select('id, nomor_tiket, nama_pelanggan, lokasi, status, keterangan, nama_cc_callback, tanggal_callback, status_callback, created_at, updated_at, regu(nama)')
    .eq('ulp_id', ulpId)
    .gte('created_at', `${selectedDate}T00:00:00+08:00`)
    .lte('created_at', `${selectedDate}T23:59:59+08:00`)
    .order('created_at', { ascending: false })

  if (selectedReguId) {
    query = query.eq('regu_id', selectedReguId)
  }

  if (selectedShiftId) {
    const { data: piket } = await supabase
      .from('piket')
      .select('id')
      .eq('ulp_id', ulpId)
      .eq('tanggal', selectedDate)
      .eq('shift_type_id', selectedShiftId)
      .single()

    query = query.eq('piket_id', piket?.id ?? '00000000-0000-0000-0000-000000000000')
  }

  const { data: laporanRaw } = await query
  
  // Transform data untuk memastikan regu adalah object (bukan array) demi TS
  const laporan = (laporanRaw ?? []).map(l => ({
    ...l,
    regu: Array.isArray(l.regu) ? (l.regu[0] ?? null) : (l.regu ?? null)
  }))

  return (
    <LaporanClient
      initialLaporan={laporan as any}
      reguList={reguList ?? []}
      shiftTypes={shiftTypes ?? []}
      initialFilters={{ tanggal: selectedDate, shift_id: selectedShiftId, regu_id: selectedReguId }}
    />
  )
}
