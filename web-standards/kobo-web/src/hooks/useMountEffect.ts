'use client'

import { useEffect, useRef } from 'react'

/**
 * The one mount-only effect: sync with something outside React once, on mount (a scroll into view, a third-party
 * widget, a document listener). The ref keeps the first `effect`, so the dependency list is complete. The cleanup it
 * returns runs on unmount.
 *
 *     useMountEffect(() => {
 *       document.addEventListener('visibilitychange', onVisible)
 *       return () => document.removeEventListener('visibilitychange', onVisible)
 *     })
 */
export function useMountEffect(effect: () => void | (() => void)) {
  const effectRef = useRef(effect)
  useEffect(() => effectRef.current(), [])
}
