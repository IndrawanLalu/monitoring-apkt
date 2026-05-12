import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { CcCallbackClient } from './cc-callback-client'

export const metadata = { title: 'CC Call Back' }
export const dynamic = 'force-dynamic'

export default async function CcCallbackPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <CcCallbackClient
      ulpNama={String(profile.activeUlp.nama)}
      ulpId={String(profile.activeUlp.id)}
    />
  )
}
