import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LaporanClient } from './laporan-client'
import { getProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const ulpId = profile.activeUlp.id
  const supabase = await createClient()

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
