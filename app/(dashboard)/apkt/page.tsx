import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { ApktMonitorClient } from './apkt-client'

export const metadata = { title: 'Monitor APKT' }
export const dynamic = 'force-dynamic'

export default async function ApktPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: reguList } = await supabase
    .from('regu')
    .select('id, nama')
    .eq('ulp_id', profile.activeUlp.id)
    .order('nama')

  return <ApktMonitorClient reguList={reguList ?? []} />
}
