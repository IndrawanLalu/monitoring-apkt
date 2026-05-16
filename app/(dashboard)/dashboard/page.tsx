import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function isShiftActive(jamMulai: string, jamSelesai: string, nowM: number): boolean {
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export default async function DashboardPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Tanggal & jam WITA (server berjalan di UTC, WITA = UTC+8)
  const nowUtc = new Date()
  const nowWita = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000)
  const nowM = nowWita.getUTCHours() * 60 + nowWita.getUTCMinutes()
  const today = nowWita.toISOString().split('T')[0]
  const supabase = createAdminClient()
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
    const todayPikets = (piketsRes.data ?? []).filter((p) => p.ulp_id === ulp.id)
    const activePiket =
      todayPikets.find((p) => {
        const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
        return isShiftActive(st.jam_mulai, st.jam_selesai, nowM)
      }) ?? null
    const reguList = (regusRes.data ?? []).filter((r) => r.ulp_id === ulp.id)
    const laporanList = (laporansRes.data ?? []).filter((l) => l.ulp_id === ulp.id)
    const petugasList = activePiket
      ? petugasFlatList.filter((p) => p.piket_id === activePiket.id)
      : []
    return { ulp, piket: activePiket, reguList, petugasList, laporanList }
  })

  return (
    <DashboardClient
      ulpDataList={ulpDataList as never}
      today={today}
    />
  )
}
