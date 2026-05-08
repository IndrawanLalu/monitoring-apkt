'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Laporan } from '@/types'

interface Options {
  ulpIds: string[]
  onInsert: (laporan: Laporan) => void
  onUpdate: (laporan: Laporan) => void
}

export function useRealtimeLaporan({ ulpIds, onInsert, onUpdate }: Options) {
  useEffect(() => {
    if (ulpIds.length === 0) return
    const supabase = createClient()

    const channels = ulpIds.map((ulpId) =>
      supabase
        .channel(`laporan_${ulpId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'laporan', filter: `ulp_id=eq.${ulpId}` }, (payload) => onInsert(payload.new as Laporan))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'laporan', filter: `ulp_id=eq.${ulpId}` }, (payload) => onUpdate(payload.new as Laporan))
        .subscribe()
    )

    return () => {
      channels.forEach((c) => supabase.removeChannel(c))
    }
  }, [ulpIds.join(','), onInsert, onUpdate])
}
