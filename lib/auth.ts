import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UlpInfo {
  id: string
  nama: string
  kode: string
  wa_grup_id: string | null
}

export interface UserProfile {
  id: string
  nama: string
  role: string
  ulps: UlpInfo[]
  activeUlp: UlpInfo
}

export async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const [{ data: profile }, { data: userUlps }] = await Promise.all([
    admin.from('profiles').select('nama, role').eq('id', user.id).single(),
    admin
      .from('user_ulp')
      .select('ulp:ulp(id, nama, kode, wa_grup_id)')
      .eq('user_id', user.id),
  ])

  if (!profile) return null

  const ulps: UlpInfo[] = (userUlps ?? [])
    .map((row) => row.ulp as unknown as UlpInfo)
    .filter(Boolean)

  if (ulps.length === 0) return null

  // Baca active ULP dari cookie, default ke ULP pertama
  const cookieStore = await cookies()
  const activeUlpId = cookieStore.get('active_ulp_id')?.value
  const activeUlp = ulps.find((u) => u.id === activeUlpId) ?? ulps[0]

  return {
    id: user.id,
    nama: profile.nama,
    role: profile.role,
    ulps,
    activeUlp,
  }
}
