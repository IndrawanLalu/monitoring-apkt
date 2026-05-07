import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, ulp_id, nama, role, created_at, ulp(id, nama, kode, wa_grup_id)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Dashboard page overrides this layout for full-screen mode */}
      <Navbar profile={profile as never} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
