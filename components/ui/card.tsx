import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={cn('card', className)}
      style={style}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function CardHeader({ children, className, style }: CardHeaderProps) {
  return (
    <div
      className={cn(className)}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        fontSize: 14,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardBody({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(className)}
      style={{ padding: 16, ...style }}
    >
      {children}
    </div>
  )
}
