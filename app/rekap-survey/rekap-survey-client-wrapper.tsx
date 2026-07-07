'use client'

import dynamic from 'next/dynamic'
import type { RekapSurveyData } from './rekap-survey-client'

const Inner = dynamic(
  () => import('./rekap-survey-client').then(m => ({ default: m.RekapSurveyClient })),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Memuat data survey...</p>
        </div>
      </div>
    ),
  }
)

export function RekapSurveyClientWrapper({ data }: { data: RekapSurveyData }) {
  return <Inner data={data} />
}
