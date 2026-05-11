import { createAdminClient } from '@/lib/supabase/admin'
import { AntrinanClient } from './antrian-client'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Antrian Laporan — PLN' }

export default async function AntrinanPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('id, nomor_tiket, regu_id, status')
    .eq('magic_token', token)
    .single()

  if (!laporan) {
    return <AntrinanClient token={token} initialData={{ found: false }} />
  }

  const reguId = laporan.regu_id as string

  const [{ data: reguData }, { data: antrian }] = await Promise.all([
    admin
      .from('regu')
      .select('id, nama, ulp(id, nama)')
      .eq('id', reguId)
      .single(),
    admin
      .from('laporan')
      .select('id, status, created_at')
      .eq('regu_id', reguId)
      .neq('status', 'selesai')
      .order('created_at', { ascending: true }),
  ])

  const regu = reguData as unknown as { id: string; nama: string; ulp: { id: string; nama: string } | null } | null
  const reguNama = regu?.nama ?? '—'
  const ulpNama = (regu?.ulp as { nama: string } | null)?.nama ?? '—'

  const isSelesai = laporan.status === 'selesai'
  const queue = (antrian ?? []).map((item, idx) => ({
    position: idx + 1,
    isOwn: (item.id as string) === (laporan.id as string),
    status: item.status as string,
  }))

  const myPosition = queue.find((q) => q.isOwn)?.position ?? 0

  return (
    <AntrinanClient
      token={token}
      initialData={{
        found: true,
        reguNama,
        ulpNama,
        myStatus: laporan.status as string,
        myNomor: laporan.nomor_tiket as string,
        isSelesai,
        myPosition: isSelesai ? 0 : myPosition,
        totalAntrian: isSelesai ? 0 : queue.length,
        queue: isSelesai ? [] : queue,
      }}
    />
  )
}
