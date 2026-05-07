import { NextRequest, NextResponse } from 'next/server'
import { kirimLaporanBaru } from '@/lib/wa/send'

export async function POST(req: NextRequest) {
  const { laporan_id } = await req.json()
  if (!laporan_id) return NextResponse.json({ error: 'laporan_id diperlukan' }, { status: 400 })

  try {
    await kirimLaporanBaru(laporan_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengirim WA'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
