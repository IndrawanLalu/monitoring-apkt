'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Laporan } from '@/types'

interface Options {
  ulpId: string
  onInsert: (laporan: Laporan) => void
  onUpdate: (laporan: Laporan) => void
}

export function useRealtimeLaporan({ ulpId, onInsert, onUpdate }: Options) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`laporan_${ulpId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'laporan',
          filter: `ulp_id=eq.${ulpId}`,
        },
        (payload) => onInsert(payload.new as Laporan),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'laporan',
          filter: `ulp_id=eq.${ulpId}`,
        },
        (payload) => onUpdate(payload.new as Laporan),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ulpId, onInsert, onUpdate])
}
