import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth'
import { LaporanClient } from './laporan-client'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{
    ulp_id?: string
    mode?: string
    tanggal?: string
    shift_id?: string
    regu_id?: string
    status?: string
  }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login?err=no-profile')
  if (profile.ulps.length === 0) redirect('/settings')

  const sp = await searchParams

  // ULP aktif dipilih lewat URL, bukan lewat cookie `active_ulp_id`.
  //
  // Halaman ini dulu terikat pada profile.activeUlp — satu ULP, tanpa pemilih di
  // UI. Untuk super_admin yang cakupannya 16 ULP, hasilnya selalu ULP pertama
  // secara abjad tanpa jalan keluar: laporan ULP lain tidak pernah bisa dilihat.
  const ulps = profile.ulps
  const activeUlp = ulps.find((u) => u.id === sp.ulp_id) ?? ulps[0]
  const ulpId = activeUlp.id

  // Mode bawaan "menggantung": semua laporan yang BELUM selesai, tanpa batas
  // tanggal. Itu pertanyaan yang sebenarnya dipakai sehari-hari — "apa yang
  // masih belum beres?" — bukan "apa yang masuk hari ini".
  const modeTanggal = sp.mode === 'tanggal'
  const tanggal = sp.tanggal ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  const supabase = createAdminClient()

  const [{ data: reguList }, { data: shiftTypes }] = await Promise.all([
    supabase.from('regu').select('id, nama').eq('ulp_id', ulpId).order('nama'),
    supabase.from('shift_type').select('id, nama').order('nama'),
  ])

  let query = supabase
    .from('laporan')
    .select(
      'id, nomor_tiket, nama_pelanggan, lokasi, status, keterangan, nama_cc_callback, tanggal_callback, status_callback, created_at, updated_at, regu(nama)',
    )
    .eq('ulp_id', ulpId)

  if (modeTanggal) {
    query = query
      .gte('created_at', `${tanggal}T00:00:00+08:00`)
      .lte('created_at', `${tanggal}T23:59:59+08:00`)
      .order('created_at', { ascending: false })

    if (sp.shift_id) {
      const { data: piket } = await supabase
        .from('piket')
        .select('id')
        .eq('ulp_id', ulpId)
        .eq('tanggal', tanggal)
        .eq('shift_type_id', sp.shift_id)
        .single()
      query = query.eq('piket_id', piket?.id ?? '00000000-0000-0000-0000-000000000000')
    }
  } else {
    // Yang paling lama menggantung naik ke atas — itu yang perlu ditindak duluan.
    query = query.neq('status', 'selesai').order('created_at', { ascending: true }).limit(500)
  }

  if (sp.regu_id) query = query.eq('regu_id', sp.regu_id)
  if (sp.status) query = query.eq('status', sp.status)

  const { data: laporanRaw } = await query

  // Supabase mengembalikan relasi sebagai array; dijadikan objek agar TS senang.
  const laporan = (laporanRaw ?? []).map((l) => ({
    ...l,
    regu: Array.isArray(l.regu) ? (l.regu[0] ?? null) : (l.regu ?? null),
  }))

  return (
    <LaporanClient
      initialLaporan={laporan as never}
      ulps={ulps.map((u) => ({ id: u.id, nama: u.nama }))}
      activeUlpId={ulpId}
      reguList={reguList ?? []}
      shiftTypes={shiftTypes ?? []}
      initialFilters={{
        mode: modeTanggal ? 'tanggal' : 'menggantung',
        tanggal,
        shift_id: sp.shift_id,
        regu_id: sp.regu_id,
        status: sp.status,
      }}
    />
  )
}
