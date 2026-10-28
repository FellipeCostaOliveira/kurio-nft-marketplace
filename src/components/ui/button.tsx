import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        outline: 'border border-primary text-primary bg-transparent hover:bg-accent',
        ghost: 'text-foreground hover:bg-surface-2',
        link: 'text-link underline-offset-4 hover:underline px-0 h-auto',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        destructive: 'bg-destructive text-primary-foreground hover:opacity-90',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'size-9',
        'icon-sm': 'size-7 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} disabled={asChild ? undefined : disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && !asChild ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
})
Button.displayName = 'Button'

export { buttonVariants }
