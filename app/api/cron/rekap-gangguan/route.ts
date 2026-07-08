import { NextRequest, NextResponse } from 'next/server'
import { kirimRekapGangguanSemua, kirimRekapGangguanUlp } from '@/lib/wa/rekap-gangguan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pemicu manual/eksternal rekap gangguan belum selesai.
 * Scheduler in-app sudah jalan otomatis tiap 3 jam (lihat lib/wa/rekap-gangguan.ts);
 * endpoint ini untuk tes manual atau opsi crontab.
 *
 * Auth: header `x-cron-key: <CRON_SECRET>` (atau ?key=). Wajib CRON_SECRET di env.
 * Opsional: ?ulp_id=<id> untuk kirim satu ULP saja.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET belum di-set di server' }, { status: 500 })
  }
  const key = req.headers.get('x-cron-key') ?? req.nextUrl.searchParams.get('key')
  if (key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ulpId = req.nextUrl.searchParams.get('ulp_id')
  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  const results = ulpId
    ? [await kirimRekapGangguanUlp(ulpId, { dryRun })]
    : await kirimRekapGangguanSemua({ dryRun })

  return NextResponse.json({ success: true, dryRun, count: results.length, results })
}

export const GET = handle
export const POST = handle
