import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  srOnlyLabel?: boolean
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => React.ReactNode
}

/** Campo com label, dica e mensagem de erro associadas (aria-describedby). */
export function Field({ id, label, required, error, hint, className, srOnlyLabel, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id} className={cn(srOnlyLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="ml-0.5 text-[#e0765a]" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs text-destructive">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}
