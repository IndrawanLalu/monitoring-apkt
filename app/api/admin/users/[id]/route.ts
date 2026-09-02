import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { passwordBaruSchema } from '@/lib/validations/auth'
import { peranPengelola } from '@/lib/otorisasi'
import { BOLEH_MEMBUAT } from '@/constants'
import { catatAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function verifyUserAdminAccess(adminClient: any, targetUserId: string, adminUlpIds: string[]) {
  const { data } = await adminClient
    .from('user_ulp')
    .select('ulp_id')
    .eq('user_id', targetUserId)

  if (data && data.length > 0) {
    return data.some((r: any) => adminUlpIds.includes(r.ulp_id))
  }

  return false
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()
  const adminUlpIds = profile.ulps.map((u) => u.id)

  const hasAccess = await verifyUserAdminAccess(admin, id, adminUlpIds)
  if (!hasAccess) {
    return NextResponse.json({ error: 'User tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { nama, password, ulp_ids, role, up3_id, uiw_id } = body

    // ── Ubah peran ──
    // Dibatasi daftar yang sama dengan pembuatan akun, supaya tidak ada
    // jalan memutar: membuat operator lalu menaikkannya jadi uiw.
    if (typeof role === 'string' && role) {
      const bolehDibuat = BOLEH_MEMBUAT[profile.role] ?? []
      if (!bolehDibuat.includes(role)) {
        return NextResponse.json(
          { error: `Anda tidak berwenang memberikan peran "${role}".` },
          { status: 403 },
        )
      }
      if (id === profile.id) {
        return NextResponse.json(
          { error: 'Anda tidak bisa mengubah peran akun Anda sendiri.' },
          { status: 400 },
        )
      }
      if (role === 'up3' && !up3_id) {
        return NextResponse.json({ error: 'Akun Admin UP3 wajib dipasangkan ke satu UP3' }, { status: 400 })
      }
      if (role === 'uiw' && profile.role !== 'super_admin') {
        return NextResponse.json({ error: 'Hanya Super Admin yang dapat memberikan peran UIW' }, { status: 403 })
      }

      const { data: sebelum } = await admin
        .from('profiles').select('nama, role').eq('id', id).maybeSingle()

      const { error: eRole } = await admin
        .from('profiles')
        .update({
          role,
          up3_id: role === 'up3' ? up3_id : null,
          uiw_id: role === 'uiw' ? uiw_id : null,
        })
        .eq('id', id)
      if (eRole) {
        console.error('[user PATCH role]', eRole)
        return NextResponse.json({ error: 'Gagal mengubah peran' }, { status: 500 })
      }

      await catatAudit({
        aktorId: profile.id, aktorNama: profile.nama,
        aksi: 'ubah_peran', sasaranId: id,
        sasaranNama: (sebelum?.nama as string) ?? null,
        keterangan: `${sebelum?.role ?? '?'} → ${role}`,
      })
    }

    // 1. Update password di Supabase Auth jika ada
    if (password && password.trim().length > 0) {
      const cekPassword = passwordBaruSchema.safeParse(password)
      if (!cekPassword.success) {
        return NextResponse.json({ error: cekPassword.error.issues[0].message }, { status: 400 })
      }
      const { error: pwError } = await admin.auth.admin.updateUserById(id, { password })
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 400 })
      }
    }

    // 2. Update nama di profiles jika ada
    if (nama && nama.trim().length > 0) {
      const { error: profError } = await admin
        .from('profiles')
        .update({ nama })
        .eq('id', id)

      if (profError) {
        return NextResponse.json({ error: profError.message }, { status: 500 })
      }
    }

    // 3. Update user_ulp jika ada
    if (ulp_ids && Array.isArray(ulp_ids) && ulp_ids.length > 0) {
      for (const uid of ulp_ids) {
        if (!adminUlpIds.includes(uid)) {
          return NextResponse.json({ error: 'ULP tidak valid atau di luar wewenang Anda' }, { status: 400 })
        }
      }

      // Hapus relasi lama
      await admin.from('user_ulp').delete().eq('user_id', id)

      // Insert relasi baru
      const uuInserts = ulp_ids.map((uid) => ({ user_id: id, ulp_id: uid }))
      const { error: uuError } = await admin.from('user_ulp').insert(uuInserts)

      if (uuError) {
        return NextResponse.json({ error: uuError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || !peranPengelola(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  // Tanpa penjagaan ini, seorang admin bisa menghapus akunnya sendiri dan
  // mengunci diri dari sistem — pemulihannya hanya lewat SQL manual.
  if (id === profile.id) {
    return NextResponse.json(
      { error: 'Anda tidak bisa menghapus akun Anda sendiri. Minta admin lain yang melakukannya.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const adminUlpIds = profile.ulps.map((u) => u.id)

  const hasAccess = await verifyUserAdminAccess(admin, id, adminUlpIds)
  if (!hasAccess) {
    return NextResponse.json({ error: 'User tidak ditemukan atau di luar wewenang Anda' }, { status: 403 })
  }

  // Diambil sebelum dihapus — sesudahnya namanya sudah hilang dari database
  // dan jejak auditnya jadi tidak bisa dibaca orang.
  const { data: sasaran } = await admin
    .from('profiles').select('nama, role').eq('id', id).maybeSingle()

  try {
    // Hapus dari user_ulp dan profiles terlebih dahulu agar aman
    await admin.from('user_ulp').delete().eq('user_id', id)
    await admin.from('profiles').delete().eq('id', id)

    // Hapus dari Supabase Auth
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      console.error('[user DELETE]', error)
      return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 })
    }

    await catatAudit({
      aktorId: profile.id, aktorNama: profile.nama,
      aksi: 'hapus_user', sasaranId: id,
      sasaranNama: (sasaran?.nama as string) ?? null,
      keterangan: sasaran?.role ? `peran ${sasaran.role}` : null,
    })

    return NextResponse.json({ data: { success: true } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
