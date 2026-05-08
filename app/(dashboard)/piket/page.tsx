import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PiketClient } from './piket-client'
import { getProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PiketPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const ulpId = profile.activeUlp.id
  const supabase = await createClient()

  const [{ data: piketList }, { data: shiftTypes }, { data: reguList }, { data: petugasMaster }] = await Promise.all([
    supabase
      .from('piket')
      .select('id, tanggal, ulp_id, shift_type_id, nama_cc, created_at, shift_type(id, nama, jam_mulai, jam_selesai), piket_petugas(regu_id, petugas:petugas_apkt(id, nama))')
      .eq('ulp_id', ulpId)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('shift_type').select('id, nama, jam_mulai, jam_selesai'),
    supabase.from('regu').select('id, nama').eq('ulp_id', ulpId).order('nama'),
    supabase.from('petugas_apkt').select('id, nama, nomor_hp').eq('ulp_id', ulpId).order('nama'),
  ])

  return (
    <PiketClient
      ulpId={ulpId}
      role={profile.role}
      piketList={(piketList ?? []) as never}
      shiftTypes={(shiftTypes ?? []) as never}
      reguList={reguList ?? []}
      petugasMaster={petugasMaster ?? []}
    />
  )
}
