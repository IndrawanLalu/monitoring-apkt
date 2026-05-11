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

export default async function CallbackPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  const [{ data: reguRaw }, { data: ulpRaw }, { data: ulpSettings }] = await Promise.all([
    admin.from('regu').select('id, ulp_id, nama, created_at').order('nama'),
    admin.from('ulp').select('id, nama, kode, wa_grup_id, created_at'),
    admin.from('ulp').select('wa_template_callback').eq('id', profile.activeUlp.id).maybeSingle(),
  ])

  const ulpMap = new Map(
    (ulpRaw ?? []).map((u) => [
      u.id as string,
      { id: u.id as string, nama: u.nama as string, kode: u.kode as string, wa_grup_id: (u.wa_grup_id ?? null) as string | null, created_at: u.created_at as string },
    ]),
  )

  const reguList = (reguRaw ?? []).map((r) => {
    const ulpItem = ulpMap.get(r.ulp_id as string)
    return {
      id: r.id as string,
      ulp_id: r.ulp_id as string,
      nama: r.nama as string,
      created_at: r.created_at as string,
      ulpNama: ulpItem?.nama ?? (r.ulp_id as string),
    }
  })

  const raw = ulpSettings as { wa_template_callback?: string | null } | null
  const template: string = raw?.wa_template_callback || TEMPLATE_CALLBACK_DEFAULT

  return (
    <CallbackClient
      reguList={reguList}
      ulpId={String(profile.activeUlp.id)}
      ulpNama={String(profile.activeUlp.nama)}
      template={template}
    />
  )
}
