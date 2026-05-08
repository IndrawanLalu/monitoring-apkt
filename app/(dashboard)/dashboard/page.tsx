import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const ulpId = profile.activeUlp.id
  const today = new Date().toISOString().split('T')[0]
  const supabase = await createClient()

  const { data: piketList } = await supabase
    .from('piket')
    .select('id, tanggal, ulp_id, shift_type_id, nama_cc, shift_type(id, nama, jam_mulai, jam_selesai), ulp(id, nama, kode, wa_grup_id)')
    .eq('ulp_id', ulpId)
    .eq('tanggal', today)

  const { data: reguList } = await supabase
    .from('regu')
    .select('id, ulp_id, nama, created_at')
    .eq('ulp_id', ulpId)
    .order('nama')

  const piketIds = piketList?.map((p) => p.id) ?? []
  const { data: piketPetugasRaw } = piketIds.length > 0
    ? await supabase
        .from('piket_petugas')
        .select('piket_id, regu_id, petugas:petugas_apkt(id, ulp_id, nama, nomor_hp, created_at)')
        .in('piket_id', piketIds)
    : { data: [] }

  const petugasList = (piketPetugasRaw ?? []).map((pp) => {
    const p = pp.petugas as unknown as { id: string; ulp_id: string; nama: string; nomor_hp: string | null; created_at: string }
    return { id: p.id, ulp_id: p.ulp_id, regu_id: pp.regu_id, nama: p.nama, nomor_hp: p.nomor_hp, created_at: p.created_at }
  })

  const { data: laporanList } = await supabase
    .from('laporan')
    .select('id, nomor_tiket, ulp_id, piket_id, regu_id, nama_pelanggan, nomor_pelanggan, lokasi, status, keterangan, magic_token, wa_message_id, created_at, updated_at, resolved_at')
    .eq('ulp_id', ulpId)
    .order('created_at', { ascending: false })

  return (
    <DashboardClient
      profile={{ id: profile.id, nama: profile.nama, role: profile.role, ulp: profile.activeUlp } as never}
      piketList={(piketList ?? []) as never}
      reguList={reguList ?? []}
      petugasList={petugasList ?? []}
      laporanList={laporanList ?? []}
      today={today}
    />
  )
}
