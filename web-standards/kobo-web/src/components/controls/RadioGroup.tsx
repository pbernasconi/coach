'use client'

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '../../lib/cn'
import { focusRing } from './Button'

/**
 * A group of radio buttons. Arrow keys move between items; the group is one tab stop.
 * Give the group a name with `aria-label` or `aria-labelledby`.
 *
 *     <RadioGroup value={size} onValueChange={setSize} aria-label="Size">
 *       <div className="flex items-center gap-2"><RadioGroupItem value="s" id="s" /><Label htmlFor="s">Small</Label></div>
 *     </RadioGroup>
 */
export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} />
}

/** One radio button of a `RadioGroup`. */
export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'aspect-square size-4 shrink-0 rounded-full border border-line-strong bg-surface shadow-card',
        'transition-colors duration-(--motion-state) ease-standard',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'aria-[invalid=true]:border-danger-ink',
        focusRing,
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex size-full items-center justify-center">
        <span className="size-1.5 rounded-full bg-on-brand" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}
