'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { Skeleton } from '../feedback/Skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '../overlays/Tooltip'
import { useSidebar } from './useSidebar'

/** A list of sidebar rows. */
export function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" data-sidebar="menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
}

/** One sidebar row: a `SidebarMenuButton`, with an optional action, badge or sub-list. */
export function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props} />
}

export const sidebarMenuButtonVariants = cva(
  [
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-control p-2 text-left text-body text-ink outline-none',
    'transition-[width,height,padding,background-color,color] duration-(--motion-state) ease-standard',
    'group-has-data-[sidebar=menu-action]/menu-item:pr-8',
    'group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!',
    'focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-sunken',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    'data-[active=true]:bg-brand-soft data-[active=true]:font-semibold data-[active=true]:text-brand-ink',
    'data-[state=open]:hover:bg-surface-raised',
    '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        plain: 'hover:bg-surface-raised',
        outline: 'bg-canvas ring-1 ring-line hover:bg-surface-raised',
      },
      size: {
        regular: 'h-8 text-body',
        compact: 'h-7 text-footnote',
        large: 'h-12 text-body group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: { variant: 'plain', size: 'regular' },
  },
)

export interface SidebarMenuButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  /** Render the child (a link) with the row styles. */
  asChild?: boolean
  /** The row of the current page. */
  isActive?: boolean
  /** A label that shows on hover when the sidebar is shrunk to icons. */
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
}

/**
 * The clickable part of a sidebar row. Use `asChild` with a link; mark the current page with `isActive`
 * (it also sets `aria-current="page"`).
 *
 *     <SidebarMenuButton asChild isActive={path === '/notes'} tooltip="Notes">
 *       <a href="/notes"><NotebookPen /><span>Notes</span></a>
 *     </SidebarMenuButton>
 */
export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'plain',
  size = 'regular',
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const { isMobile, state } = useSidebar()
  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      aria-current={isActive ? 'page' : undefined}
      {...(asChild ? {} : { type: 'button' as const })}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
  if (!tooltip) return button
  const content = typeof tooltip === 'string' ? { children: tooltip } : tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" variant="standard" hidden={state !== 'collapsed' || isMobile} {...content} />
    </Tooltip>
  )
}

/** An icon button at the right of a row, for example a "More" menu. Give it an `aria-label`. */
export function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean; showOnHover?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      {...(asChild ? {} : { type: 'button' as const })}
      className={cn(
        'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-inner p-0',
        'text-ink-muted outline-none transition-transform hover:bg-surface-raised hover:text-ink',
        'focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0',
        // A bigger hit area on a phone.
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=compact]/menu-button:top-1 peer-data-[size=regular]/menu-button:top-1.5 peer-data-[size=large]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

/** A count at the right of a row. */
export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-badge px-1',
        'text-footnote font-semibold text-ink-muted tabular-nums select-none',
        'peer-data-[active=true]/menu-button:text-brand-ink',
        'peer-data-[size=compact]/menu-button:top-1 peer-data-[size=regular]/menu-button:top-1.5 peer-data-[size=large]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  )
}

/** A placeholder row while the menu loads. Wrap a group of them in `SkeletonRegion`. */
export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & { showIcon?: boolean }) {
  // A width from 50% to 90%, fixed for the life of the row, so the placeholders do not look like a grid.
  const [width] = React.useState(() => `${Math.floor(Math.random() * 40) + 50}%`)
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-control px-2', className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-inner" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={{ '--skeleton-width': width } as React.CSSProperties}
      />
    </div>
  )
}
