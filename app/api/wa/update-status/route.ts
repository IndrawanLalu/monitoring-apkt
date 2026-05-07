import { NextRequest, NextResponse } from 'next/server'
import { kirimUpdateStatus } from '@/lib/wa/send'
import type { StatusLaporan } from '@/types'

export async function POST(req: NextRequest) {
  const { laporan_id, status, keterangan } = await req.json()
  if (!laporan_id || !status) {
    return NextResponse.json({ error: 'laporan_id dan status diperlukan' }, { status: 400 })
  }

  try {
    await kirimUpdateStatus(laporan_id, status as StatusLaporan, keterangan ?? null)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengirim WA'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
