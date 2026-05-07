'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'yellow'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-pln-blue text-white hover:bg-pln-blue-mid',
  secondary: 'bg-neo-white text-neo-black hover:bg-neo-gray',
  danger: 'bg-pln-red text-white hover:opacity-90',
  ghost: 'bg-transparent text-neo-black border-transparent! shadow-none! hover:bg-neo-gray',
  yellow: 'bg-pln-yellow text-neo-black hover:opacity-90',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'neo-button inline-flex items-center justify-center gap-2 font-bold transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[2px_2px_0px_#1A1A1A]',
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

export { Button }
