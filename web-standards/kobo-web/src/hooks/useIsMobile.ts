'use client'

import { useEffect, useState } from 'react'

/** The width (in CSS pixels) where the layout stops being a phone layout. It matches Tailwind's `md`. */
export const MOBILE_BREAKPOINT = 768

/**
 * True below `breakpoint` (a phone layout). It is false on the server and on the first render, then follows the
 * viewport. Put a `hidden md:flex` class on the desktop markup, so the first paint on a phone has no flash.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return isMobile
}
