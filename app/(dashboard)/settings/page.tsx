import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'
import { getProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const ulpId = profile.activeUlp.id
  const supabase = await createClient()

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
      .select('id, user_id, status, session_data, updated_at')
      .eq('user_id', profile.id)
      .maybeSingle(),
  ])

  return (
    <SettingsClient
      profile={{ ulp_id: ulpId, role: profile.role, ulp: profile.activeUlp, userId: profile.id } as never}
      reguList={reguList ?? []}
      petugasList={petugasList ?? []}
      waSession={waSession}
    />
  )
}
