/** The sizes, keys and pure rules of the `Sidebar` family. */

export const SIDEBAR_COOKIE_NAME = 'sidebar_state'
export const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
export const SIDEBAR_WIDTH = '220px'
export const SIDEBAR_WIDTH_MOBILE = '18rem'
export const SIDEBAR_WIDTH_ICON = '3rem'
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

export type SidebarState = 'expanded' | 'collapsed'

export const sidebarState = (open: boolean): SidebarState => (open ? 'expanded' : 'collapsed')

/** The cookie that keeps the open state for the next page load, so the server can render it the same way. */
export const sidebarCookie = (
  open: boolean,
  name: string = SIDEBAR_COOKIE_NAME,
  maxAgeSeconds: number = SIDEBAR_COOKIE_MAX_AGE_SECONDS,
): string => `${name}=${open}; path=/; max-age=${maxAgeSeconds}`

export interface ShortcutEventLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  defaultPrevented?: boolean
}

/** True for ⌘B on a Mac and Ctrl+B elsewhere, unless another handler took the key. */
export const isSidebarShortcut = (event: ShortcutEventLike): boolean =>
  !event.defaultPrevented && event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)

/** Resolves a `setOpen` argument (a value or an updater) against the current value. */
export const resolveOpen = (value: boolean | ((open: boolean) => boolean), current: boolean): boolean =>
  typeof value === 'function' ? value(current) : value
