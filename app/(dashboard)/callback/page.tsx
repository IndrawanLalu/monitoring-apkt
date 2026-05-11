import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CallbackClient } from './callback-client'

export const metadata = { title: 'CC Callback' }
export const dynamic = 'force-dynamic'

const TEMPLATE_CALLBACK_DEFAULT = `Yth. Bapak/Ibu *{nama}*

Terima kasih telah menggunakan layanan pengaduan PLN.
Laporan Bapak/Ibu telah kami terima dengan nomor lapor *{nomor_tiket}* dan sudah diteruskan kepada petugas lapangan untuk ditindaklanjuti.
Saat ini laporan tersebut sedang dalam proses antre penanganan.

Mohon kesediaan Bapak/Ibu untuk memastikan nomor handphone tetap aktif, karena petugas lapangan kami akan menghubungi Bapak/Ibu melalui nomor telepon yang telah terdaftar.

Terima kasih atas perhatian dan kerja sama Bapak/Ibu.

Hormat kami,
Command Center PLN {ulp}
Melayani Sepenuh Hati`

function isShiftActive(jamMulai: string, jamSelesai: string, nowM: number): boolean {
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export default async function CallbackPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const ulpId = profile.activeUlp.id

  // Jam & tanggal WITA (UTC+8)
  const nowWita = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const today = nowWita.toISOString().split('T')[0]
  const nowM = nowWita.getUTCHours() * 60 + nowWita.getUTCMinutes()

  const [{ data: reguRaw }, { data: ulpRaw }, { data: ulpSettings }, { data: todayPikets }] = await Promise.all([
    admin.from('regu').select('id, ulp_id, nama, nomor_hp, created_at').eq('ulp_id', ulpId).order('nama'),
    admin.from('ulp').select('id, nama, kode, wa_grup_id, created_at'),
    admin.from('ulp').select('wa_template_callback').eq('id', ulpId).maybeSingle(),
    admin
      .from('piket')
      .select('id, shift_type(jam_mulai, jam_selesai)')
      .eq('ulp_id', ulpId)
      .eq('tanggal', today),
  ])

  // Cari piket yang shift-nya sedang aktif sekarang
  const activePiket = (todayPikets ?? []).find((p) => {
    const st = p.shift_type as unknown as { jam_mulai: string; jam_selesai: string }
    return isShiftActive(st.jam_mulai, st.jam_selesai, nowM)
  }) ?? null

  // Ambil regu_id yang ada di piket aktif
  let activeReguIds: string[] = []
  if (activePiket) {
    const { data: pp } = await admin
      .from('piket_petugas')
      .select('regu_id')
      .eq('piket_id', activePiket.id)
    activeReguIds = [...new Set((pp ?? []).map((p) => p.regu_id as string))]
  }

  const noActivePiket = !activePiket || activeReguIds.length === 0

  const ulpMap = new Map(
    (ulpRaw ?? []).map((u) => [
      u.id as string,
      { nama: u.nama as string },
    ]),
  )

  // Hanya regu yang masuk piket aktif
  const reguList = (reguRaw ?? [])
    .filter((r) => !noActivePiket && activeReguIds.includes(r.id as string))
    .map((r) => ({
      id: r.id as string,
      ulp_id: r.ulp_id as string,
      nama: r.nama as string,
      nomor_hp: (r.nomor_hp ?? null) as string | null,
      created_at: r.created_at as string,
      ulpNama: ulpMap.get(r.ulp_id as string)?.nama ?? (r.ulp_id as string),
    }))

  const raw = ulpSettings as { wa_template_callback?: string | null } | null
  const template: string = raw?.wa_template_callback || TEMPLATE_CALLBACK_DEFAULT

  return (
    <CallbackClient
      reguList={reguList}
      ulpId={String(ulpId)}
      ulpNama={String(profile.activeUlp.nama)}
      template={template}
      noActivePiket={noActivePiket}
    />
  )
}
