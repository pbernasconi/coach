'use client'

import { createContext, useContext } from 'react'
import type { SidebarState } from './sidebarState'

export interface SidebarContextValue {
  /** `expanded` or `collapsed` on a desktop. The mobile drawer uses `openMobile`. */
  state: SidebarState
  open: boolean
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void
  openMobile: boolean
  setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void
  isMobile: boolean
  /** Opens or closes the drawer on a phone, and expands or collapses the sidebar on a desktop. */
  toggleSidebar: () => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

/** The sidebar state. Use it inside a `SidebarProvider`, for example to close the drawer after a page change. */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider.')
  return context
}
