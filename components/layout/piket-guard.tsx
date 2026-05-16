'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { ShiftType } from '@/types'

function isShiftActive(jamMulai: string, jamSelesai: string, nowM: number): boolean {
  const [mh, mm] = jamMulai.split(':').map(Number)
  const [sh, sm] = jamSelesai.split(':').map(Number)
  const mulai = mh * 60 + (mm ?? 0)
  const selesai = sh * 60 + (sm ?? 0)
  if (selesai > mulai) return nowM >= mulai && nowM < selesai
  return nowM >= mulai || nowM < selesai
}

export function PiketGuard({ shifts }: { shifts: Array<{ jam_mulai: string, jam_selesai: string }> }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return
    if (pathname === '/piket' || pathname === '/settings' || pathname === '/outage') return

    const checkActive = () => {
      const nowUtc = new Date()
      const nowWita = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000)
      const nowM = nowWita.getUTCHours() * 60 + nowWita.getUTCMinutes()

      const hasActive = shifts.some(s => isShiftActive(s.jam_mulai, s.jam_selesai, nowM))
      if (!hasActive) {
        router.push('/piket')
      }
    }

    checkActive()
    const interval = setInterval(checkActive, 60000) // check every 1 minute
    return () => clearInterval(interval)
  }, [shifts, pathname, router, isClient])

  return null
}
