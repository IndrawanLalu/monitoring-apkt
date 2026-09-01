import { NextRequest, NextResponse } from 'next/server'
import { ambilDataAntrian } from '@/lib/antrian'

// Endpoint polling untuk halaman antrian pelanggan. Logikanya ada di
// lib/antrian.ts, dipakai bersama dengan render awal di server — dulu halaman
// memanggil endpoint ini lewat HTTP ke dirinya sendiri.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const hasil = await ambilDataAntrian(token)

  if (!hasil.found) {
    return NextResponse.json({ found: false }, { status: 404 })
  }
  return NextResponse.json(hasil)
}
