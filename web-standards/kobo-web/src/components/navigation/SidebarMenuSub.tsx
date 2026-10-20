import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/cn'

/** A nested list of rows under a `SidebarMenuItem`, with a line on its left. Hidden when the sidebar shrinks to icons. */
export function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-line px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  )
}

/** One nested row. */
export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" className={cn('group/menu-sub-item relative', className)} {...props} />
}

export interface SidebarMenuSubButtonProps extends React.ComponentProps<'a'> {
  /** Render the child (a router link) with the row styles. */
  asChild?: boolean
  size?: 'compact' | 'regular'
  /** The row of the current page. It also sets `aria-current="page"`. */
  isActive?: boolean
}

/**
 * The link of a nested row.
 *
 *     <SidebarMenuSubButton href="/projects/garden" isActive>Garden</SidebarMenuSubButton>
 */
export function SidebarMenuSubButton({
  asChild = false,
  size = 'regular',
  isActive = false,
  className,
  ...props
}: SidebarMenuSubButtonProps) {
  const Comp = asChild ? Slot : 'a'
  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-control px-2 text-ink outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring hover:bg-surface-raised active:bg-surface-sunken',
        'aria-disabled:pointer-events-none aria-disabled:opacity-45',
        '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-muted',
        'data-[active=true]:bg-brand-soft data-[active=true]:text-brand-ink',
        size === 'compact' ? 'text-footnote' : 'text-body',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  )
}
