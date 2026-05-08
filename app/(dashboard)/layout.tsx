import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { getProfile } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar profile={profile} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
