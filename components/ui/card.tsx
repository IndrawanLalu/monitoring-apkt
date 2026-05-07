import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  color?: string
}

export function Card({ children, className, color }: CardProps) {
  return (
    <div
      className={cn('neo-card p-4', className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
  color?: string
}

export function CardHeader({ children, className, color }: CardHeaderProps) {
  return (
    <div
      className={cn('px-4 py-3 border-b-2 border-neo-black font-bold', className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>
}
