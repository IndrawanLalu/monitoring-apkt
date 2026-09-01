import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBarisUlp } from '@/lib/otorisasi'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const izin = await requireBarisUlp('petugas_apkt', id)
  if (izin.response) return izin.response

  const admin = createAdminClient()
  const { error } = await admin.from('petugas_apkt').delete().eq('id', id)
  if (error) {
    console.error('[petugas DELETE]', error)
    return NextResponse.json({ error: 'Gagal menghapus petugas' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
