import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PiketGuard } from '@/components/layout/piket-guard'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  
  // Ambil tanggal hari ini (WITA)
  const nowUtc = new Date()
  const nowWita = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000)
  const today = nowWita.toISOString().split('T')[0]

  const ulpIds = profile.ulps.map((u) => u.id)
  
  // Ambil semua piket hari ini untuk semua ULP user
  const { data: pikets } = await supabase
    .from('piket')
    .select('id, shift_type(id, jam_mulai, jam_selesai)')
    .in('ulp_id', ulpIds)
    .eq('tanggal', today)

  // Kumpulkan semua shift yang dikaitkan dengan piket hari ini
  const activeShifts = (pikets ?? []).map(p => {
    const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
    return { jam_mulai: st.jam_mulai, jam_selesai: st.jam_selesai }
  })

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <PiketGuard shifts={activeShifts} />
      <Navbar profile={profile} />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  )
}
