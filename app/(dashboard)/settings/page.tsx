import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SettingsClient } from './settings-client'
import { getProfile } from '@/lib/auth'

const TEMPLATE_CALLBACK_DEFAULT = `Yth. Bapak/Ibu *{nama}*

Terima kasih telah menggunakan layanan pengaduan PLN.
Laporan Bapak/Ibu telah kami terima dengan nomor lapor *{nomor_tiket}* dan sudah diteruskan kepada petugas lapangan untuk ditindaklanjuti.
Saat ini laporan tersebut sedang dalam proses antre penanganan.

Mohon kesediaan Bapak/Ibu untuk memastikan nomor handphone tetap aktif, karena petugas lapangan kami akan menghubungi Bapak/Ibu melalui nomor telepon yang telah terdaftar.

Terima kasih atas perhatian dan kerja sama Bapak/Ibu.

Hormat kami,
Command Center PLN {ulp}
Melayani Sepenuh Hati`

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const ulpId = profile.activeUlp.id
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: reguList }, { data: petugasList }, { data: waSession }, { data: ulpData }] = await Promise.all([
    supabase
      .from('regu')
      .select('id, ulp_id, nama, nomor_hp, created_at')
      .eq('ulp_id', ulpId)
      .order('nama'),
    supabase
      .from('petugas_apkt')
      .select('id, ulp_id, regu_id, nama, nomor_hp, created_at')
      .eq('ulp_id', ulpId)
      .order('nama'),
    supabase
      .from('wa_session')
      .select('id, user_id, status, session_data, updated_at')
      .eq('user_id', profile.id)
      .maybeSingle(),
    admin
      .from('ulp')
      .select('wa_template_callback')
      .eq('id', ulpId)
      .single(),
  ])

  const templateCallback =
    (ulpData as { wa_template_callback?: string | null } | null)?.wa_template_callback ?? TEMPLATE_CALLBACK_DEFAULT

  return (
    <SettingsClient
      key={ulpId}
      profile={{ ulp_id: ulpId, role: profile.role, ulp: profile.activeUlp, userId: profile.id, ulps: profile.ulps } as never}
      reguList={reguList ?? []}
      petugasList={petugasList ?? []}
      waSession={waSession}
      templateCallback={templateCallback}
    />
  )
}
