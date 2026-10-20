'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TooltipProvider } from '../overlays/Tooltip'
import {
  isSidebarShortcut,
  resolveOpen,
  sidebarCookie,
  sidebarState,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
} from './sidebarState'
import { SidebarContext, type SidebarContextValue } from './useSidebar'

export interface SidebarProviderProps extends React.ComponentProps<'div'> {
  defaultOpen?: boolean
  /** Control the desktop open state from outside. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** The cookie that keeps the open state. `null` keeps no cookie. */
  cookieName?: string | null
}

/**
 * Holds the sidebar state and lays out the sidebar beside the page. ⌘B (Ctrl+B) toggles it. On a phone the
 * sidebar is a drawer.
 *
 *     <SidebarProvider>
 *       <Sidebar>…</Sidebar>
 *       <SidebarInset><SidebarTrigger />…</SidebarInset>
 *     </SidebarProvider>
 */
export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  cookieName = SIDEBAR_COOKIE_NAME,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen)
  const open = openProp ?? innerOpen

  const setOpen = React.useCallback(
    (value: boolean | ((open: boolean) => boolean)) => {
      const next = resolveOpen(value, open)
      if (setOpenProp) setOpenProp(next)
      else setInnerOpen(next)
      if (cookieName) document.cookie = sidebarCookie(next, cookieName)
    },
    [cookieName, open, setOpenProp],
  )

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((current) => !current)
    else setOpen((current) => !current)
  }, [isMobile, setOpen])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSidebarShortcut(event)) return
      event.preventDefault()
      toggleSidebar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])

  const value = React.useMemo<SidebarContextValue>(
    () => ({ state: sidebarState(open), open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [open, setOpen, isMobile, openMobile, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={{ '--sidebar-width': SIDEBAR_WIDTH, '--sidebar-width-icon': SIDEBAR_WIDTH_ICON, ...style } as React.CSSProperties}
          className={cn('group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-canvas', className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}
