'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

/* ---- shared label style ---- */
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 4,
  display: 'block',
}

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginTop: 3,
}

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#E4002B',
  marginTop: 3,
  fontWeight: 500,
}

/* ---- Input ---- */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, style, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {label && <label htmlFor={inputId} style={labelStyle}>{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn('input', error && 'input-error', className)}
          style={{
            borderColor: error ? '#E4002B' : undefined,
            boxShadow: error ? '0 0 0 3px rgba(228,0,43,0.15)' : undefined,
            ...style,
          }}
          {...props}
        />
        {error && <p style={errorStyle}>{error}</p>}
        {hint && !error && <p style={hintStyle}>{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

/* ---- Textarea ---- */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, style, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {label && <label htmlFor={inputId} style={labelStyle}>{label}</label>}
        <textarea
          ref={ref}
          id={inputId}
          className={cn('input', error && 'input-error', className)}
          style={{
            resize: 'vertical',
            minHeight: 80,
            borderColor: error ? '#E4002B' : undefined,
            boxShadow: error ? '0 0 0 3px rgba(228,0,43,0.15)' : undefined,
            ...style,
          }}
          {...props}
        />
        {error && <p style={errorStyle}>{error}</p>}
        {hint && !error && <p style={hintStyle}>{hint}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

/* ---- Select ---- */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, style, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {label && <label htmlFor={inputId} style={labelStyle}>{label}</label>}
        <select
          ref={ref}
          id={inputId}
          className={cn('input', error && 'input-error', className)}
          style={{
            cursor: 'pointer',
            borderColor: error ? '#E4002B' : undefined,
            boxShadow: error ? '0 0 0 3px rgba(228,0,43,0.15)' : undefined,
            ...style,
          }}
          {...props}
        >
          {children}
        </select>
        {error && <p style={errorStyle}>{error}</p>}
        {hint && !error && <p style={hintStyle}>{hint}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Input, Textarea, Select }
