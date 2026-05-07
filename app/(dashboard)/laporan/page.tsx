import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LaporanClient } from './laporan-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('ulp_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.ulp_id) redirect('/login')

  const ulpId = profile.ulp_id

  const [{ data: laporanList }, { data: reguList }] = await Promise.all([
    supabase
      .from('laporan')
      .select('id, nomor_tiket, ulp_id, regu_id, nama_pelanggan, nomor_pelanggan, lokasi, status, keterangan, magic_token, wa_message_id, created_at, updated_at, resolved_at, piket_id')
      .eq('ulp_id', ulpId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('regu')
      .select('id, ulp_id, nama, created_at')
      .eq('ulp_id', ulpId)
      .order('nama'),
  ])

  return (
    <LaporanClient
      ulpId={ulpId}
      role={profile.role}
      laporanList={laporanList ?? []}
      reguList={reguList ?? []}
    />
  )
}
