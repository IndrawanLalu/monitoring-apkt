'use client'

import dynamic from 'next/dynamic'
import type { RekapData } from './rekap-client'

const RekapClientInner = dynamic(
  () => import('./rekap-client').then(m => ({ default: m.RekapClient })),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Memuat data rekap...</p>
        </div>
      </div>
    ),
  }
)

export function RekapClientWrapper({ data }: { data: RekapData }) {
  return <RekapClientInner data={data} />
}
