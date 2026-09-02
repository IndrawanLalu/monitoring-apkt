import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { passwordBaruSchema } from '@/lib/validations/auth'
import { peranPengelola } from '@/lib/otorisasi'
import { BOLEH_MEMBUAT } from '@/constants'
import { catatAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
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

  // 2. Ambil profil SEMUA peran, bukan hanya 'cc'.
  // Versi lama menyaring .eq('role','cc') sehingga admin tidak pernah muncul
  // di daftar — tidak bisa dilihat, apalagi dicabut, lewat UI.
  const { data: profilesRows, error: profError } = await admin
    .from('profiles')
    .select('id, nama, role')
    .in('id', userIdsInUlps)
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
      role: p.role as string,
      // Akun sendiri ditandai supaya UI bisa mencegah admin menghapus dirinya
      // sendiri dan mengunci diri dari sistem.
      diriSendiri: uid === profile.id,
      email: authUsersMap.get(uid) ?? '-',
      ulp_id: assignedUlps[0] ?? '',
      ulps: assignedUlps,
    }
  })

  return NextResponse.json({ data: result })
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  const adminUlpIds = profile.ulps.map((u) => u.id)

  try {
    const body = await req.json()
    const { nama, email, password, ulp_ids, role, up3_id, uiw_id } = body

    if (!nama || !email || !password) {
      return NextResponse.json({ error: 'Nama, email, dan password wajib diisi' }, { status: 400 })
    }

    // Peran yang boleh dibuat dibatasi peran pembuatnya — mencegah eskalasi.
    // Seorang 'up3' tidak boleh bisa membuat akun 'uiw' apalagi 'super_admin'.
    const bolehDibuat = BOLEH_MEMBUAT[profile.role] ?? []
    const peranBaru = typeof role === 'string' && role ? role : 'operator'
    if (!bolehDibuat.includes(peranBaru)) {
      return NextResponse.json(
        { error: `Anda tidak berwenang membuat akun dengan peran "${peranBaru}".` },
        { status: 403 },
      )
    }

    // Cakupan wajib sesuai tingkat perannya. Tanpa ini akun baru tidak
    // melihat apa pun, dan kesalahannya baru ketahuan saat orangnya login.
    if (peranBaru === 'operator' && (!Array.isArray(ulp_ids) || ulp_ids.length === 0)) {
      return NextResponse.json({ error: 'Operator wajib diberi minimal 1 ULP' }, { status: 400 })
    }
    if (peranBaru === 'up3' && !up3_id) {
      return NextResponse.json({ error: 'Akun Admin UP3 wajib dipasangkan ke satu UP3' }, { status: 400 })
    }
    if (peranBaru === 'uiw' && !uiw_id) {
      return NextResponse.json({ error: 'Akun Admin UIW wajib dipasangkan ke satu UIW' }, { status: 400 })
    }

    // Divalidasi di server, bukan hanya di form — form bisa dilewati.
    const cekPassword = passwordBaruSchema.safeParse(password)
    if (!cekPassword.success) {
      return NextResponse.json({ error: cekPassword.error.issues[0].message }, { status: 400 })
    }

    // ULP yang diberikan harus berada dalam cakupan si pembuat.
    for (const uid of (ulp_ids ?? [])) {
      if (!adminUlpIds.includes(uid)) {
        return NextResponse.json({ error: 'ULP tidak valid atau di luar wewenang Anda' }, { status: 400 })
      }
    }

    // Begitu juga UP3/UIW tujuan — jangan sampai admin UP3 A membuat admin
    // untuk UP3 B hanya dengan mengirim id lain di body.
    if (peranBaru === 'up3' && profile.role !== 'super_admin') {
      const { data: sah } = await admin.from('up3').select('id')
        .eq('id', up3_id)
        .eq('uiw_id', profile.uiw_id ?? '00000000-0000-0000-0000-000000000000')
        .maybeSingle()
      if (!sah) {
        return NextResponse.json({ error: 'UP3 di luar wewenang Anda' }, { status: 403 })
      }
    }
    if (peranBaru === 'uiw' && profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya Super Admin yang dapat membuat akun UIW' }, { status: 403 })
    }

    // 1. Buat user di Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama, role: peranBaru },
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
        nama,
        role: peranBaru,
        up3_id: peranBaru === 'up3' ? up3_id : null,
        uiw_id: peranBaru === 'uiw' ? uiw_id : null,
      })

    if (profError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profError.message }, { status: 500 })
    }

    // 3. Insert ke user_ulp — hanya untuk operator.
    // Peran up3/uiw cakupannya berasal dari hierarki, bukan dari assignment,
    // jadi daftar ULP-nya memang kosong dan tidak ada yang perlu disisipkan.
    const uuInserts = (ulp_ids ?? []).map((uid: string) => ({ user_id: userId, ulp_id: uid }))
    const { error: uuError } = uuInserts.length > 0
      ? await admin.from('user_ulp').insert(uuInserts)
      : { error: null }

    if (uuError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: uuError.message }, { status: 500 })
    }

    await catatAudit({
      aktorId: profile.id, aktorNama: profile.nama,
      aksi: 'buat_user', sasaranId: userId, sasaranNama: nama,
      keterangan: `peran ${peranBaru}`,
    })

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
