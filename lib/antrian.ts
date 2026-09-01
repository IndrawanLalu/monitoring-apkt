import { createAdminClient } from '@/lib/supabase/admin'

/** Berapa banyak antrian di atas & di bawah posisi pelanggan yang ikut dikirim. */
const JENDELA = 5

export interface AntrianItem {
  position: number
  isOwn: boolean
  status: string
}

export interface HasilAntrian {
  found: boolean
  reguNama?: string
  ulpNama?: string
  myStatus?: string
  myNomor?: string
  namaPelanggan?: string
  alamat?: string
  isSelesai?: boolean
  surveyDone?: boolean
  myPosition?: number
  totalAntrian?: number
  queue?: AntrianItem[]
  queueDipotong?: boolean
}

/**
 * Data halaman antrian pelanggan, dipakai bersama oleh render awal di server
 * (app/antrian/[token]/page.tsx) dan endpoint polling (/api/antrian/[token]).
 *
 * Sebelumnya halaman memanggil endpoint-nya sendiri lewat HTTP ke
 * NEXT_PUBLIC_APP_URL — server menelepon dirinya sendiri, melalui DNS pihak
 * ketiga (nip.io). Itu menambah satu lompatan jaringan pada halaman yang paling
 * ramai di aplikasi ini, dan membuat render awalnya bergantung pada layanan DNS
 * di luar kendali. Sekarang halaman memanggil fungsi ini langsung.
 *
 * Catatan beban: fungsi ini di-polling tiap 120 detik oleh SETIAP pelanggan yang
 * gangguannya masih terbuka. Karena itu antrian tidak ditarik seluruhnya —
 * posisi dan total diambil lewat count (tanpa transfer baris), lalu hanya
 * sepotong jendela di sekitar posisi pelanggan yang benar-benar diambil.
 * Biayanya tetap, berapa pun panjang antrian regu.
 */
export async function ambilDataAntrian(token: string): Promise<HasilAntrian> {
  const admin = createAdminClient()

  const { data: laporan } = await admin
    .from('laporan')
    .select('id, nomor_tiket, nama_pelanggan, lokasi, regu_id, status, created_at')
    .eq('magic_token', token)
    .single()

  if (!laporan) return { found: false }

  const reguId = laporan.regu_id as string
  const isSelesai = laporan.status === 'selesai'

  const [{ data: reguData }, { data: surveyData }] = await Promise.all([
    admin.from('regu').select('id, nama, ulp(id, nama)').eq('id', reguId).single(),
    admin.from('survey_laporan').select('id').eq('laporan_id', laporan.id).maybeSingle(),
  ])

  const regu = reguData as unknown as { id: string; nama: string; ulp: { id: string; nama: string } | null } | null

  let myPosition = 0
  let totalAntrian = 0
  let queue: AntrianItem[] = []

  if (!isSelesai) {
    const dasar = () =>
      admin.from('laporan').select('*', { count: 'exact', head: true })
        .eq('regu_id', reguId).neq('status', 'selesai')

    const [{ count: total }, { count: sebelum }] = await Promise.all([
      dasar(),
      // Termasuk baris ini sendiri, jadi hasilnya langsung nomor antriannya.
      dasar().lte('created_at', laporan.created_at as string),
    ])

    totalAntrian = total ?? 0
    myPosition = sebelum ?? 0

    const dari = Math.max(0, myPosition - 1 - JENDELA)
    const sampai = dari + JENDELA * 2

    const { data: jendela } = await admin
      .from('laporan')
      .select('id, status')
      .eq('regu_id', reguId)
      .neq('status', 'selesai')
      .order('created_at', { ascending: true })
      .range(dari, sampai)

    queue = (jendela ?? []).map((item, i) => ({
      position: dari + i + 1,
      isOwn: (item.id as string) === (laporan.id as string),
      status: item.status as string,
    }))
  }

  return {
    found: true,
    reguNama: regu?.nama ?? '—',
    ulpNama: (regu?.ulp as { nama: string } | null)?.nama ?? '—',
    myStatus: laporan.status as string,
    myNomor: laporan.nomor_tiket as string,
    namaPelanggan: laporan.nama_pelanggan as string,
    alamat: laporan.lokasi as string,
    isSelesai,
    surveyDone: !!surveyData,
    myPosition,
    totalAntrian,
    queue,
    // Klien perlu tahu daftarnya dipotong, agar bisa menandai "…" di atas/bawah.
    queueDipotong: !isSelesai && totalAntrian > queue.length,
  }
}
