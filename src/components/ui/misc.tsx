import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...props} />
}

export const RadioGroup = React.forwardRef<React.ComponentRef<typeof RadioGroupPrimitive.Root>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>>(
  ({ className, ...props }, ref) => <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2', className)} {...props} />,
)
RadioGroup.displayName = 'RadioGroup'

export const RadioGroupItem = React.forwardRef<React.ComponentRef<typeof RadioGroupPrimitive.Item>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>>(
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-primary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50', className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
    </RadioGroupPrimitive.Item>
  ),
)
RadioGroupItem.displayName = 'RadioGroupItem'

export const Checkbox = React.forwardRef<React.ComponentRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring', className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
)
Checkbox.displayName = 'Checkbox'

export const Tabs = TabsPrimitive.Root
export const TabsList = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('flex flex-wrap items-end gap-6 border-b border-border', className)} {...props} />
))
TabsList.displayName = 'TabsList'
export const TabsTrigger = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn('-mb-px border-b-2 border-transparent pb-2 text-sm font-semibold text-foreground data-[state=active]:border-primary data-[state=active]:text-primary focus-visible:outline-2 focus-visible:outline-ring', className)}
      {...props}
    />
  ),
)
TabsTrigger.displayName = 'TabsTrigger'
export const TabsContent = TabsPrimitive.Content

export const Slider = React.forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }>(
  ({ className, thumbLabels = [], ...props }, ref) => (
    <SliderPrimitive.Root ref={ref} className={cn('relative flex w-full touch-none select-none items-center py-2', className)} {...props}>
      <SliderPrimitive.Track className="relative h-0.5 w-full grow overflow-hidden rounded-full bg-primary/40">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb key={i} aria-label={thumbLabels[i]} className="block size-3.5 rounded-full bg-primary shadow focus-visible:outline-2 focus-visible:outline-ring" />
      ))}
    </SliderPrimitive.Root>
  ),
)
Slider.displayName = 'Slider'
