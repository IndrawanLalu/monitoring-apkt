import { AntrinanClient, type AntrianData } from './antrian-client'
import { ambilDataAntrian } from '@/lib/antrian'
import { ringkasGalat } from '@/lib/log'

export const dynamic = 'force-dynamic'

export default async function AntrinanPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Dipanggil langsung, bukan lewat fetch ke API-nya sendiri.
  // Versi lama menembak `${NEXT_PUBLIC_APP_URL}/api/antrian/${token}` — server
  // menelepon dirinya sendiri melalui DNS pihak ketiga (nip.io), menambah satu
  // lompatan jaringan pada halaman paling ramai di aplikasi ini dan membuat
  // render awalnya bergantung pada layanan di luar kendali. Juga berarti render
  // awal diam-diam gagal setiap kali NEXT_PUBLIC_APP_URL tidak lagi cocok
  // dengan alamat server yang sebenarnya.
  let initialData: AntrianData = { found: false }
  try {
    initialData = (await ambilDataAntrian(token)) as AntrianData
  } catch (e) {
    // Klien tetap mengambil ulang sendiri, jadi halaman tidak kosong —
    // tapi kegagalannya dicatat, tidak ditelan diam-diam seperti sebelumnya.
    console.error('[antrian] gagal memuat data awal:', ringkasGalat(e))
  }

  return <AntrinanClient token={token} initialData={initialData} />
}
