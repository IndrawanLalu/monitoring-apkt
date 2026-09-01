import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBarisUlp } from '@/lib/otorisasi'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const izin = await requireBarisUlp('piket', id)
  if (izin.response) return izin.response

  const admin = createAdminClient()
  const { error } = await admin.from('piket').delete().eq('id', id)

  if (error) {
    console.error('[piket DELETE]', error)
    return NextResponse.json({ error: 'Gagal menghapus piket' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
