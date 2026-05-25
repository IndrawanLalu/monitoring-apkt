import { cache } from 'react'
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
  up3_id: string | null
  ulps: UlpInfo[]
  activeUlp: UlpInfo | null
}

export const getProfile = cache(async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const [{ data: profile }, { data: userUlps }, { data: up3Row }] = await Promise.all([
    admin.from('profiles').select('nama, role').eq('id', user.id).single(),
    admin
      .from('user_ulp')
      .select('ulp:ulp(id, nama, kode, wa_grup_id)')
      .eq('user_id', user.id),
    admin.from('profiles').select('up3_id').eq('id', user.id).maybeSingle(),
  ])

  if (!profile) return null

  const ulps: UlpInfo[] = (userUlps ?? [])
    .map((row) => row.ulp as unknown as UlpInfo)
    .filter(Boolean)

  const up3Id = (up3Row as any)?.up3_id ?? null

  // Admin dengan up3_id boleh login meski belum punya ULP (untuk setup ULP pertama via Settings)
  if (ulps.length === 0 && !(profile.role === 'admin' && up3Id)) return null

  const cookieStore = await cookies()
  const activeUlpId = cookieStore.get('active_ulp_id')?.value
  const activeUlp = ulps.find((u) => u.id === activeUlpId) ?? ulps[0] ?? null

  return {
    id: user.id,
    nama: profile.nama,
    role: profile.role,
    up3_id: up3Id,
    ulps,
    activeUlp,
  }
})
