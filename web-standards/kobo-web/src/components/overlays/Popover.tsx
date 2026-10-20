'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/cn'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

/**
 * The floating panel of a popover. It renders in a portal above dialogs, so it works inside a `Dialog` too.
 *
 *     <Popover>
 *       <PopoverTrigger asChild><Button variant="outline">Filters</Button></PopoverTrigger>
 *       <PopoverContent align="start">…</PopoverContent>
 *     </Popover>
 */
export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-popover w-72 rounded-card border border-line bg-surface p-4 text-ink shadow-float outline-none',
          'origin-(--radix-popover-content-transform-origin)',
          'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
