import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { normJoin } from '@/lib/utils/format'
import { RekapClient, type LaporanRekap, type ReguItem, type PiketItem } from './laporan-client'

export const dynamic = 'force-dynamic'

function todayWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return wib.toISOString().split('T')[0]
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const { tanggal: tanggalParam } = await searchParams
  const tanggal = tanggalParam ?? todayWIB()
  const ulpId = profile.activeUlp.id
  const supabase = await createClient()

  const [{ data: laporanRaw }, { data: reguRaw }, { data: piketRaw }] = await Promise.all([
    supabase
      .from('laporan')
      .select('id, status, regu_id, piket_id')
      .eq('ulp_id', ulpId)
      .gte('created_at', `${tanggal}T00:00:00+07:00`)
      .lte('created_at', `${tanggal}T23:59:59.999+07:00`),
    supabase
      .from('regu')
      .select('id, nama')
      .eq('ulp_id', ulpId)
      .order('nama'),
    supabase
      .from('piket')
      .select('id, tanggal, shift_type_id, shift_type(id, nama, jam_mulai, jam_selesai)')
      .eq('ulp_id', ulpId)
      .eq('tanggal', tanggal),
  ])

  const piketList: PiketItem[] = (piketRaw ?? []).map((p) => ({
    id: p.id as string,
    tanggal: p.tanggal as string,
    shift_type_id: p.shift_type_id as string,
    shift_type: normJoin(
      p.shift_type as unknown as { id: string; nama: string; jam_mulai: string; jam_selesai: string } | null,
    ),
  }))

  return (
    <RekapClient
      tanggal={tanggal}
      laporanList={(laporanRaw ?? []) as LaporanRekap[]}
      reguList={(reguRaw ?? []) as ReguItem[]}
      piketList={piketList}
    />
  )
}
