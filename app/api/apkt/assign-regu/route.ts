import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaClient } from '@/lib/wa/client'
import { buildPesanApktPenugasan } from '@/lib/wa/messages'
import { apktState } from '@/lib/apkt/state'

interface AssignBody {
  nomorLapor: string
  reguId: string | null
  namaRegu: string
  namaPelanggan: string
  lokasi: string
  statusApkt: string
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nomorLapor, reguId, namaRegu, namaPelanggan, lokasi, statusApkt }: AssignBody =
    await request.json()

  // ── Update in-memory state ──────────────────────────────────────────────────
  if (reguId === null) {
    delete apktState.reguAssignments[nomorLapor]
  } else {
    apktState.reguAssignments[nomorLapor] = reguId
  }
  const item = apktState.data.find((d) => d.nomorLapor === nomorLapor)
  if (item) item.reguId = reguId

  // ── Kirim WA jika regu dipilih (bukan di-unassign) ─────────────────────────
  if (reguId) {
    try {
      const admin = createAdminClient()
      const { data: ulp } = await admin
        .from('ulp')
        .select('wa_grup_id')
        .eq('id', profile.activeUlp.id)
        .single()

      if (ulp?.wa_grup_id) {
        const { data: userUlps } = await admin
          .from('user_ulp')
          .select('user_id')
          .eq('ulp_id', profile.activeUlp.id)

        console.log('[APKT WA] grup:', ulp.wa_grup_id, '| users:', userUlps?.map((u) => u.user_id))

        for (const { user_id } of userUlps ?? []) {
          const waClient = getWaClient(user_id)
          console.log('[APKT WA] client user', user_id, ':', waClient ? 'ada' : 'tidak ada')
          if (!waClient) continue

          const pesan = buildPesanApktPenugasan({
            nomorLapor,
            namaPelanggan,
            lokasi: lokasi || '—',
            statusApkt,
            namaRegu,
          })
          await waClient.sendMessage(ulp.wa_grup_id, pesan)
          console.log('[APKT WA] ✅ pesan terkirim')
          break
        }
      } else {
        console.log('[APKT WA] wa_grup_id tidak ada untuk ULP', profile.activeUlp.id)
      }
    } catch (err) {
      // Assignment tetap sukses meski WA gagal — log saja
      console.error('[APKT] Gagal kirim WA penugasan:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
