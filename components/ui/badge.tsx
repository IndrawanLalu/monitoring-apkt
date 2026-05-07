import { cn } from '@/lib/utils/cn'
import { STATUS_LABEL, STATUS_COLOR, STATUS_EMOJI } from '@/constants'
import type { StatusLaporan } from '@/types'

interface StatusBadgeProps {
  status: StatusLaporan
  showEmoji?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASS = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
}

export function StatusBadge({ status, showEmoji = true, size = 'md', className }: StatusBadgeProps) {
  const color = STATUS_COLOR[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-bold border-2 border-neo-black',
        SIZE_CLASS[size],
        className,
      )}
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {showEmoji && <span>{STATUS_EMOJI[status]}</span>}
      {STATUS_LABEL[status]}
    </span>
  )
}

interface BadgeProps {
  children: React.ReactNode
  color?: string
  textColor?: string
  className?: string
}

export function Badge({ children, color = '#E5E5E5', textColor = '#1A1A1A', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-bold border border-neo-black',
        className,
      )}
      style={{ backgroundColor: color, color: textColor }}
    >
      {children}
    </span>
  )
}
