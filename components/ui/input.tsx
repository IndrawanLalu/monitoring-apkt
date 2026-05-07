'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-bold text-neo-black">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'neo-input w-full px-3 py-2 text-sm font-medium text-neo-black placeholder:text-gray-400',
            error && 'border-pln-red! shadow-[2px_2px_0px_#E4002B]!',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-pln-red">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-bold text-neo-black">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'neo-input w-full px-3 py-2 text-sm font-medium text-neo-black placeholder:text-gray-400 resize-none',
            error && 'border-pln-red! shadow-[2px_2px_0px_#E4002B]!',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-pln-red">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-bold text-neo-black">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'neo-input w-full px-3 py-2 text-sm font-medium text-neo-black cursor-pointer',
            error && 'border-pln-red! shadow-[2px_2px_0px_#E4002B]!',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs font-medium text-pln-red">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'

export { Input, Textarea, Select }
