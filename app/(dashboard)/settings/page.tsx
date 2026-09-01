import { redirect } from 'next/navigation'
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
  if (!profile) redirect('/login?err=no-profile')

  const admin = createAdminClient()
  const ulpIds = profile.ulps.map((u) => u.id)

  const [{ data: reguList }, { data: petugasList }, { data: waSession }, { data: ulpsRaw }] = await Promise.all([
    ulpIds.length > 0
      ? admin.from('regu').select('id, ulp_id, nama, nomor_hp, created_at').in('ulp_id', ulpIds).order('nama')
      : Promise.resolve({ data: [] as any[] }),
    ulpIds.length > 0
      ? admin.from('petugas_apkt').select('id, ulp_id, regu_id, nama, nomor_hp, created_at').in('ulp_id', ulpIds).order('nama')
      : Promise.resolve({ data: [] as any[] }),
    admin.from('wa_session').select('id, user_id, status, session_data, updated_at').eq('user_id', profile.id).maybeSingle(),
    ulpIds.length > 0
      ? admin.from('ulp').select('id, wa_template_callback, wa_grup_id').in('id', ulpIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const ulpSettingsMap = new Map(
    (ulpsRaw ?? []).map((u) => [
      u.id as string,
      {
        templateCallback: (u.wa_template_callback as string | null) ?? TEMPLATE_CALLBACK_DEFAULT,
        waGrupId: (u.wa_grup_id as string | null) ?? '',
      },
    ])
  )

  const ulpsData = profile.ulps.map((ulp) => ({
    ulp,
    reguList: (reguList ?? []).filter((r) => r.ulp_id === ulp.id),
    petugasList: (petugasList ?? []).filter((p) => p.ulp_id === ulp.id),
    templateCallback: ulpSettingsMap.get(ulp.id)?.templateCallback ?? TEMPLATE_CALLBACK_DEFAULT,
    waGrupId: ulpSettingsMap.get(ulp.id)?.waGrupId ?? '',
  }))

  return (
    <SettingsClient
      ulpsData={ulpsData}
      profile={{ role: profile.role, userId: profile.id, up3Id: profile.up3_id, ulps: profile.ulps }}
      waSession={waSession}
    />
  )
}
