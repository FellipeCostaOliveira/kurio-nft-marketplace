import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-9 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground/80 transition-colors',
      'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 focus-visible:border-primary',
      'aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-28 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80',
      'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 aria-[invalid=true]:border-destructive',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
