import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function verifyUserAdminAccess(adminClient: any, targetUserId: string, adminUlpIds: string[]) {
  const { data } = await adminClient
    .from('user_ulp')
    .select('ulp_id')
    .eq('user_id', targetUserId)

  if (data && data.length > 0) {
    return data.some((r: any) => adminUlpIds.includes(r.ulp_id))
  }

  // Fallback cek profiles.ulp_id
  const { data: pData } = await adminClient
    .from('profiles')
    .select('ulp_id')
    .eq('id', targetUserId)
    .single()

  if (pData && adminUlpIds.includes(pData.ulp_id)) return true

  return false
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
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
    const { nama, password, ulp_ids } = body

    // 1. Update password di Supabase Auth jika ada
    if (password && password.trim().length > 0) {
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

      // Update ulp_id utama di profiles
      await admin.from('profiles').update({ ulp_id: ulp_ids[0] }).eq('id', id)
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
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
    // Hapus dari user_ulp dan profiles terlebih dahulu agar aman
    await admin.from('user_ulp').delete().eq('user_id', id)
    await admin.from('profiles').delete().eq('id', id)

    // Hapus dari Supabase Auth
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
