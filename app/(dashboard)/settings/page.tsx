import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('ulp_id, role, ulp(id, nama, kode, wa_grup_id)')
    .eq('id', user.id)
    .single()

  if (!profile?.ulp_id) redirect('/login')

  const ulpId = profile.ulp_id

  const [{ data: reguList }, { data: petugasList }, { data: waSession }] = await Promise.all([
    supabase
      .from('regu')
      .select('id, ulp_id, nama, created_at')
      .eq('ulp_id', ulpId)
      .order('nama'),
    supabase
      .from('petugas_apkt')
      .select('id, ulp_id, regu_id, nama, nomor_hp, created_at')
      .eq('ulp_id', ulpId)
      .order('nama'),
    supabase
      .from('wa_session')
      .select('id, ulp_id, status, session_data, updated_at')
      .eq('ulp_id', ulpId)
      .maybeSingle(),
  ])

  return (
    <SettingsClient
      profile={profile as never}
      reguList={reguList ?? []}
      petugasList={petugasList ?? []}
      waSession={waSession}
    />
  )
}
