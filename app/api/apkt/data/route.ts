import { NextRequest, NextResponse } from 'next/server'
import type { ApktCommand, LaporanApkt, ScraperStatus } from '@/lib/apkt/types'
import { apktState as state } from '@/lib/apkt/state'

export async function GET() {
  return NextResponse.json(state)
}

export async function POST(request: NextRequest) {
  const body = await request.json() as
    | { type: 'status'; status: ScraperStatus; error?: string }
    | { type: 'data'; data: Omit<LaporanApkt, 'reguId'>[] }
    | { type: 'command'; command: ApktCommand }
    | { type: 'consume_command' }

  if (body.type === 'status') {
    state.scraperStatus = body.status
    if (body.error) state.error = body.error
    else delete state.error

  } else if (body.type === 'data') {
    state.scraperStatus = 'running'
    state.lastSync = new Date().toISOString()
    state.data = body.data.map((item) => ({
      ...item,
      reguId: state.reguAssignments[item.nomorLapor] ?? null,
    }))
    state.totalRows = state.data.length
    delete state.error

  } else if (body.type === 'command') {
    state.pendingCommand = body.command
    if (body.command === 'stop') {
      state.scraperStatus = 'idle'
      state.data = []
      state.totalRows = 0
      state.lastSync = null
      delete state.error
    }

  } else if (body.type === 'consume_command') {
    state.pendingCommand = null
  }

  return NextResponse.json({ ok: true })
}
