import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  const adminUlpIds = profile.ulps.map((u) => u.id)

  // 1. Ambil semua user_ulp yang ada di dalam adminUlpIds
  const { data: userUlpsRows, error: uuError } = await admin
    .from('user_ulp')
    .select('user_id, ulp_id')
    .in('ulp_id', adminUlpIds)

  if (uuError) {
    return NextResponse.json({ error: uuError.message }, { status: 500 })
  }

  const userIdsInUlps = [...new Set((userUlpsRows ?? []).map((r) => r.user_id as string))]

  if (userIdsInUlps.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 2. Ambil profiles dengan role 'cc' yang id-nya ada di userIdsInUlps
  const { data: profilesRows, error: profError } = await admin
    .from('profiles')
    .select('id, nama, role, ulp_id')
    .in('id', userIdsInUlps)
    .eq('role', 'cc')
    .order('nama')

  if (profError) {
    return NextResponse.json({ error: profError.message }, { status: 500 })
  }

  const ccProfiles = profilesRows ?? []
  const ccUserIds = ccProfiles.map((p) => p.id as string)

  if (ccUserIds.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 3. Ambil semua user_ulp untuk ccUserIds agar tahu semua ULP yang di-assign ke masing-masing CC
  const { data: ccUserUlps } = await admin
    .from('user_ulp')
    .select('user_id, ulp_id')
    .in('user_id', ccUserIds)

  // 4. Ambil email dari listUsers Supabase Auth
  const { data: authData } = await admin.auth.admin.listUsers()
  const authUsersMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email]))

  // Gabungkan data
  const result = ccProfiles.map((p) => {
    const uid = p.id as string
    const assignedUlps = (ccUserUlps ?? [])
      .filter((r) => r.user_id === uid)
      .map((r) => r.ulp_id as string)

    return {
      id: uid,
      nama: p.nama as string,
      email: authUsersMap.get(uid) ?? '-',
      ulp_id: p.ulp_id as string,
      ulps: assignedUlps,
    }
  })

  return NextResponse.json({ data: result })
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  const adminUlpIds = profile.ulps.map((u) => u.id)

  try {
    const body = await req.json()
    const { nama, email, password, ulp_ids } = body

    if (!nama || !email || !password || !ulp_ids || !Array.isArray(ulp_ids) || ulp_ids.length === 0) {
      return NextResponse.json({ error: 'Semua field wajib diisi dan pilih minimal 1 ULP' }, { status: 400 })
    }

    // Validasi ulp_ids harus bagian dari adminUlpIds
    for (const uid of ulp_ids) {
      if (!adminUlpIds.includes(uid)) {
        return NextResponse.json({ error: 'ULP tidak valid atau di luar wewenang Anda' }, { status: 400 })
      }
    }

    // 1. Buat user di Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama, role: 'cc' },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'Gagal membuat user auth' }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Insert ke profiles
    const { error: profError } = await admin
      .from('profiles')
      .insert({
        id: userId,
        ulp_id: ulp_ids[0], // ULP utama / pertama
        nama,
        role: 'cc',
      })

    if (profError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profError.message }, { status: 500 })
    }

    // 3. Insert ke user_ulp
    const uuInserts = ulp_ids.map((uid) => ({ user_id: userId, ulp_id: uid }))
    const { error: uuError } = await admin.from('user_ulp').insert(uuInserts)

    if (uuError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: uuError.message }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        id: userId,
        nama,
        email,
        ulp_id: ulp_ids[0],
        ulps: ulp_ids,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
