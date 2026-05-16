'use client'

import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'yellow'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary:   { backgroundColor: 'var(--accent)', color: '#fff' },
  secondary: { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  danger:    { backgroundColor: '#E4002B', color: '#fff' },
  ghost:     { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent', boxShadow: 'none' },
  yellow:    { backgroundColor: '#FFD200', color: '#0F172A' },
}

const VARIANT_HOVER: Record<Variant, React.CSSProperties> = {
  primary:   { backgroundColor: 'var(--accent-hover)' },
  secondary: { backgroundColor: 'var(--bg-surface-3)', borderColor: 'var(--border-strong)' },
  danger:    { backgroundColor: '#C50025' },
  ghost:     { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' },
  yellow:    { opacity: 0.9 },
}

const SIZE_STYLE: Record<Size, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: 12, borderRadius: 6 },
  md: { padding: '8px 16px', fontSize: 14, borderRadius: 8 },
  lg: { padding: '11px 22px', fontSize: 15, borderRadius: 8 },
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ style, variant = 'primary', size = 'md', loading = false, children, disabled, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontWeight: 600,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.5 : 1,
      transition: 'all 0.2s ease',
      border: 'none',
      outline: 'none',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      ...VARIANT_STYLE[variant],
      ...SIZE_STYLE[size],
      ...style,
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={baseStyle}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            Object.assign(e.currentTarget.style, VARIANT_HOVER[variant], { transform: 'translateY(-1px)' })
          }
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            Object.assign(e.currentTarget.style, VARIANT_STYLE[variant], SIZE_STYLE[size], { transform: '' })
          }
          onMouseLeave?.(e)
        }}
        {...props}
      >
        {loading && (
          <span style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

export { Button }
