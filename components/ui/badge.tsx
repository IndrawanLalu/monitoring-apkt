import { STATUS_LABEL, STATUS_COLOR, STATUS_EMOJI } from '@/constants'
import type { StatusLaporan } from '@/types'

/* ---- StatusBadge ---- */
interface StatusBadgeProps {
  status: StatusLaporan
  showEmoji?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_STYLE = {
  sm: { fontSize: 10, padding: '2px 7px' },
  md: { fontSize: 11, padding: '3px 9px' },
  lg: { fontSize: 13, padding: '4px 11px' },
}

// Adaptive colors per status — light mode uses tinted bg, dark handles via globals.css .status-*
const STATUS_CSS_CLASS: Record<StatusLaporan, string> = {
  lapor:            'status-lapor',
  penugasan_regu:   'status-penugasan-regu',
  ditangani:        'status-ditangani',
  nyala_sementara:  'status-nyala-sementara',
  selesai:          'status-selesai',
}

export function StatusBadge({ status, showEmoji = true, size = 'md', className }: StatusBadgeProps) {
  return (
    <span
      className={`badge ${STATUS_CSS_CLASS[status]} ${className ?? ''}`}
      style={SIZE_STYLE[size]}
    >
      {showEmoji && <span style={{ fontSize: '1em' }}>{STATUS_EMOJI[status]}</span>}
      {STATUS_LABEL[status]}
    </span>
  )
}

/* ---- Generic Badge ---- */
interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'blue' | 'green' | 'red' | 'yellow' | 'orange'
  className?: string
}

const VARIANT_STYLE: Record<string, React.CSSProperties> = {
  default: { backgroundColor: 'var(--bg-surface-3)', color: 'var(--text-secondary)' },
  blue:    { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' },
  green:   { backgroundColor: 'rgba(29,185,84,0.12)', color: '#15803d' },
  red:     { backgroundColor: 'rgba(228,0,43,0.12)', color: '#E4002B' },
  yellow:  { backgroundColor: 'rgba(255,210,0,0.15)', color: '#B38F00' },
  orange:  { backgroundColor: 'rgba(245,166,35,0.15)', color: '#B36D00' },
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={`badge ${className ?? ''}`}
      style={VARIANT_STYLE[variant]}
    >
      {children}
    </span>
  )
}
