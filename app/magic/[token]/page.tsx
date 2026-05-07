import { createAdminClient } from '@/lib/supabase/admin'
import { MagicUpdateClient } from './magic-update-client'
import { STATUS_LABEL, STATUS_EMOJI } from '@/constants'

interface Props {
  params: Promise<{ token: string }>
}

export default async function MagicLinkPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('id, nomor_tiket, nama_pelanggan, lokasi, status, keterangan, regu(id, nama)')
    .eq('magic_token', token)
    .single()

  if (!laporan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neo-white p-4">
        <div className="neo-card max-w-sm w-full p-6 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-black text-neo-black">Link Tidak Valid</h1>
          <p className="text-sm text-gray-500 mt-2">Link ini tidak ditemukan atau sudah kadaluarsa.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neo-white p-4">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="neo-card mb-4 p-4 text-center" style={{ backgroundColor: '#003B8E' }}>
          <span className="text-3xl">⚡</span>
          <h1 className="text-white font-black text-lg mt-1">Update Status Laporan</h1>
          <p className="text-blue-200 text-xs mt-0.5">Monitoring APKT — PLN</p>
        </div>

        {/* Laporan Info */}
        <div className="neo-card mb-4">
          <div className="p-3 border-b-2 border-neo-black bg-neo-gray">
            <p className="text-xs font-bold text-gray-500 uppercase">Nomor Tiket</p>
            <p className="text-xl font-black text-neo-black">#{laporan.nomor_tiket}</p>
          </div>
          <div className="p-3 space-y-2 text-sm">
            <div>
              <span className="font-bold text-gray-500">Pelanggan: </span>
              <span className="font-medium">{laporan.nama_pelanggan}</span>
            </div>
            <div>
              <span className="font-bold text-gray-500">Lokasi: </span>
              <span className="font-medium">{laporan.lokasi}</span>
            </div>
            <div>
              <span className="font-bold text-gray-500">Regu: </span>
              <span className="font-medium">{(laporan.regu as unknown as { nama: string } | null)?.nama ?? '—'}</span>
            </div>
            {laporan.keterangan && (
              <div>
                <span className="font-bold text-gray-500">Keterangan: </span>
                <span className="font-medium italic">{laporan.keterangan}</span>
              </div>
            )}
            <div className="pt-1">
              <span className="font-bold text-gray-500">Status saat ini: </span>
              <span className="font-black">
                {STATUS_EMOJI[laporan.status as keyof typeof STATUS_EMOJI]} {STATUS_LABEL[laporan.status as keyof typeof STATUS_LABEL]}
              </span>
            </div>
          </div>
        </div>

        {/* Update Form */}
        {laporan.status === 'selesai' ? (
          <div className="neo-card p-6 text-center" style={{ backgroundColor: '#1DB954' }}>
            <p className="text-white font-black text-lg">✅ Laporan Sudah Selesai</p>
            <p className="text-green-100 text-sm mt-1">Tidak ada tindakan lebih lanjut</p>
          </div>
        ) : (
          <MagicUpdateClient laporan={laporan as never} token={token} />
        )}
      </div>
    </div>
  )
}
