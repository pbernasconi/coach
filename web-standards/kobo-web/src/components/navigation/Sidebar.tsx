'use client'

import * as React from 'react'
import { PanelLeft } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../overlays/Sheet'
import { StandardTooltip } from '../overlays/StandardTooltip'
import { SIDEBAR_WIDTH_MOBILE } from './sidebarState'
import { useSidebar } from './useSidebar'

export interface SidebarProps extends React.ComponentProps<'div'> {
  side?: 'left' | 'right'
  /** `sidebar` sits flush; `floating` is a card; `inset` makes the page a card beside it. */
  variant?: 'sidebar' | 'floating' | 'inset'
  /** `offcanvas` slides away, `icon` shrinks to icons, `none` always shows. A phone always gets the drawer. */
  collapsible?: 'offcanvas' | 'icon' | 'none'
  /** The title of the drawer on a phone, for screen readers. */
  label?: string
  /** The description of the drawer on a phone, for screen readers. */
  description?: string
}

/**
 * The app's side navigation. On a phone it is a drawer (a `Sheet`) for every `collapsible` value; a fixed column
 * would take more than half of the screen. Put it in a `SidebarProvider`.
 *
 *     <Sidebar collapsible="icon">
 *       <SidebarHeader>…</SidebarHeader>
 *       <SidebarContent><SidebarGroup>…</SidebarGroup></SidebarContent>
 *       <SidebarRail />
 *     </Sidebar>
 */
export function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  label = 'Sidebar',
  description = 'The main navigation.',
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          hideClose
          className="w-(--sidebar-width) bg-surface p-0 text-ink"
          style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  if (collapsible === 'none') {
    // `hidden md:flex` keeps it off a phone on the first render, before useIsMobile turns true and the drawer
    // takes over.
    return (
      <div
        data-slot="sidebar"
        className={cn('hidden min-h-svh w-(--sidebar-width) flex-col border-r border-line bg-surface text-ink md:flex', className)}
        {...props}
      >
        {children}
      </div>
    )
  }

  const boxed = variant === 'floating' || variant === 'inset'
  return (
    <div
      className="group peer hidden text-ink md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* Holds the space of the fixed sidebar in the page flow. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-(--motion-enter) ease-standard',
          'group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180',
          boxed
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          'fixed inset-y-0 z-nav hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-(--motion-enter) ease-standard md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          boxed
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem+2px)]'
            : 'border-line group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex h-full w-full flex-col bg-surface group-data-[variant=floating]:rounded-card group-data-[variant=floating]:border group-data-[variant=floating]:border-line group-data-[variant=floating]:shadow-card"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** The button that opens and closes the sidebar (the drawer on a phone). */
export function SidebarTrigger({
  className,
  onClick,
  'aria-label': ariaLabel = 'Toggle sidebar',
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar()
  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="plain"
      size="icon-compact"
      aria-label={ariaLabel}
      aria-expanded={isMobile ? openMobile : open}
      className={cn('text-ink-muted hover:text-ink', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft aria-hidden="true" />
    </Button>
  )
}

/** A thin strip on the sidebar's inner edge that toggles it on click. Pointer only: the trigger and ⌘B cover the keyboard. */
export function SidebarRail({ className, title = 'Toggle sidebar', ...props }: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar()
  return (
    <StandardTooltip content={title}>
      <button
        type="button"
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label={title}
        tabIndex={-1}
        onClick={toggleSidebar}
        className={cn(
          'absolute inset-y-0 z-sticky hidden w-4 -translate-x-1/2 transition-all duration-(--motion-state) ease-standard sm:flex',
          'group-data-[side=left]:-right-4 group-data-[side=right]:left-0',
          'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 hover:after:bg-line-strong',
          'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
          '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
          'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
          'hover:group-data-[collapsible=offcanvas]:bg-surface',
          '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
          className,
        )}
        {...props}
      />
    </StandardTooltip>
  )
}

/** The page beside the sidebar: the `main` landmark. With `variant="inset"` it is a card. */
export function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'relative flex w-full flex-1 flex-col bg-canvas',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-sheet',
        'md:peer-data-[variant=inset]:shadow-card md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  )
}
