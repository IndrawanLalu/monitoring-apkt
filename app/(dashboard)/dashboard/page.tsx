import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const supabase = await createClient()
  const ulpIds = profile.ulps.map((u) => u.id)

  const [piketsRes, regusRes, laporansRes] = await Promise.all([
    supabase
      .from('piket')
      .select('id, tanggal, ulp_id, shift_type_id, nama_cc, shift_type(id, nama, jam_mulai, jam_selesai)')
      .in('ulp_id', ulpIds)
      .eq('tanggal', today),
    supabase
      .from('regu')
      .select('id, ulp_id, nama, created_at')
      .in('ulp_id', ulpIds)
      .order('nama'),
    supabase
      .from('laporan')
      .select('id, nomor_tiket, ulp_id, piket_id, regu_id, nama_pelanggan, nomor_pelanggan, lokasi, status, keterangan, magic_token, wa_message_id, created_at, updated_at, resolved_at')
      .in('ulp_id', ulpIds)
      .order('created_at', { ascending: false }),
  ])

  const piketIds = (piketsRes.data ?? []).map((p) => p.id)
  const { data: piketPetugasRaw } = piketIds.length > 0
    ? await supabase
        .from('piket_petugas')
        .select('piket_id, regu_id, petugas:petugas_apkt(id, ulp_id, nama, nomor_hp, created_at)')
        .in('piket_id', piketIds)
    : { data: [] }

  const petugasFlatList = (piketPetugasRaw ?? []).map((pp) => {
    const p = pp.petugas as unknown as { id: string; ulp_id: string; nama: string; nomor_hp: string | null; created_at: string }
    return { id: p.id, ulp_id: p.ulp_id, regu_id: pp.regu_id, piket_id: pp.piket_id, nama: p.nama, nomor_hp: p.nomor_hp ?? null, created_at: p.created_at }
  })

  const ulpDataList = profile.ulps.map((ulp) => {
    const piket = (piketsRes.data ?? []).find((p) => p.ulp_id === ulp.id) ?? null
    const reguList = (regusRes.data ?? []).filter((r) => r.ulp_id === ulp.id)
    const laporanList = (laporansRes.data ?? []).filter((l) => l.ulp_id === ulp.id)
    const petugasList = piket
      ? petugasFlatList.filter((p) => p.piket_id === piket.id)
      : []
    return { ulp, piket, reguList, petugasList, laporanList }
  })

  return (
    <DashboardClient
      ulpDataList={ulpDataList as never}
      today={today}
    />
  )
}
