'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'
import { focusRing } from './Button'

/**
 * Tabs that switch panels in place. Arrow keys move between tabs.
 *
 *     <Tabs defaultValue="notes">
 *       <TabsList aria-label="Views"><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="files">Files</TabsTrigger></TabsList>
 *       <TabsContent value="notes">…</TabsContent>
 *     </Tabs>
 */
export const Tabs = TabsPrimitive.Root

/** The row of tabs: a sunken track with the active tab raised. */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex h-9 items-center justify-center rounded-control bg-surface-raised p-1 text-ink-muted', className)}
      {...props}
    />
  )
}

/** One tab. */
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center rounded-inner px-3 py-1 text-body font-semibold whitespace-nowrap',
        'transition-[background-color,color,box-shadow] duration-(--motion-state) ease-standard',
        'hover:text-ink disabled:pointer-events-none disabled:opacity-45',
        'data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-card',
        focusRing,
        className,
      )}
      {...props}
    />
  )
}

/** The panel of one tab. */
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-2 rounded-inner', focusRing, className)} {...props} />
}
