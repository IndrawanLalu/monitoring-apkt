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

  if (ulpIds.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 3rem)', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>Belum ada ULP terdaftar</p>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Buat ULP pertama di <a href="/settings" style={{ color: '#003B8E', fontWeight: 700 }}>Settings → Kelola ULP</a></p>
      </div>
    )
  }

  const [piketsRes, regusRes, laporansRes, ulpsRes] = await Promise.all([
    supabase
      .from('piket')
      .select('id, tanggal, ulp_id, shift_type_id, nama_cc, shift_type(id, nama, jam_mulai, jam_selesai)')
      .in('ulp_id', ulpIds)
      .eq('tanggal', today),
    supabase
      .from('regu')
      .select('id, ulp_id, nama, nomor_hp, created_at')
      .in('ulp_id', ulpIds)
      .order('nama'),
    supabase
      .from('laporan')
      .select('id, nomor_tiket, ulp_id, piket_id, regu_id, nama_pelanggan, nomor_pelanggan, lokasi, status, keterangan, magic_token, wa_message_id, created_at, updated_at, resolved_at')
      .in('ulp_id', ulpIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('ulp')
      .select('id, wa_template_callback')
      .in('id', ulpIds),
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

  const templateMap = new Map(
    (ulpsRes.data ?? []).map((u) => [u.id, u.wa_template_callback as string | null])
  )

  const DEFAULT_TEMPLATE = `Yth. Bapak/Ibu *{nama}*

Terima kasih telah menggunakan layanan pengaduan PLN.
Laporan Bapak/Ibu telah kami terima dengan nomor lapor *{nomor_tiket}* dan sudah diteruskan kepada petugas lapangan untuk ditindaklanjuti.

Mohon kesediaan Bapak/Ibu untuk memastikan nomor handphone tetap aktif, karena petugas lapangan kami akan menghubungi Bapak/Ibu melalui nomor telepon yang telah terdaftar.

Terima kasih atas perhatian dan kerja sama Bapak/Ibu.

Hormat kami,
Command Center PLN {ulp}
Melayani Sepenuh Hati`

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
    const template = templateMap.get(ulp.id) ?? DEFAULT_TEMPLATE
    return { ulp, piket: activePiket, reguList, petugasList, laporanList, template }
  })

  return (
    <DashboardClient
      ulpDataList={ulpDataList as never}
      today={today}
    />
  )
}
