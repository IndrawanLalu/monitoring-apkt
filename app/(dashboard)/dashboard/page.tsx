import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user profile & ULP
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, ulp_id, nama, role, ulp(id, nama, kode, wa_grup_id)')
    .eq('id', user.id)
    .single()

  if (!profile?.ulp_id) redirect('/login')

  const ulpId = profile.ulp_id
  const today = new Date().toISOString().split('T')[0]

  // Get or create today's piket (ambil semua shift hari ini)
  const { data: piketList } = await supabase
    .from('piket')
    .select('id, tanggal, ulp_id, shift_type_id, nama_cc, shift_type(id, nama, jam_mulai, jam_selesai), ulp(id, nama, kode, wa_grup_id)')
    .eq('ulp_id', ulpId)
    .eq('tanggal', today)

  // Get regu for this ULP
  const { data: reguList } = await supabase
    .from('regu')
    .select('id, ulp_id, nama, created_at')
    .eq('ulp_id', ulpId)
    .order('nama')

  // Get petugas dari piket_petugas untuk piket hari ini
  const piketIds = piketList?.map((p) => p.id) ?? []
  const { data: piketPetugasRaw } = piketIds.length > 0
    ? await supabase
        .from('piket_petugas')
        .select('piket_id, regu_id, petugas:petugas_apkt(id, ulp_id, nama, nomor_hp, created_at)')
        .in('piket_id', piketIds)
    : { data: [] }

  // Bentuk ulang ke Petugas[] dengan regu_id dari piket_petugas
  const petugasList = (piketPetugasRaw ?? []).map((pp) => {
    const p = pp.petugas as unknown as { id: string; ulp_id: string; nama: string; nomor_hp: string | null; created_at: string }
    return { id: p.id, ulp_id: p.ulp_id, regu_id: pp.regu_id, nama: p.nama, nomor_hp: p.nomor_hp, created_at: p.created_at }
  })

  // Get active laporan (not selesai) for today
  const { data: laporanList } = await supabase
    .from('laporan')
    .select('id, nomor_tiket, ulp_id, piket_id, regu_id, nama_pelanggan, nomor_pelanggan, lokasi, status, keterangan, magic_token, wa_message_id, created_at, updated_at, resolved_at')
    .eq('ulp_id', ulpId)
    .order('created_at', { ascending: false })

  return (
    <DashboardClient
      profile={profile as never}
      piketList={(piketList ?? []) as never}
      reguList={reguList ?? []}
      petugasList={petugasList ?? []}
      laporanList={laporanList ?? []}
      today={today}
    />
  )
}
