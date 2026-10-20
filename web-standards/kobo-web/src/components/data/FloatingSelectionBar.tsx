'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

export interface FloatingSelectionBarProps {
  /** The number of selected items. The bar shows only when it is more than 0. */
  count: number
  /** Escape calls it. It clears the selection. */
  onDismiss?: () => void
  /** The singular noun of the count, for example "file". */
  itemNoun: string
  /** The count line. The default is "2 files selected" (it adds an "s" for more than one). */
  countLabel?: (count: number, itemNoun: string) => string
  /** Extra words after the count, for example "ZIP file". */
  hint?: string
  /** The spoken name of the bar. */
  regionLabel?: string
  /** The actions, usually `Button`s. */
  children: ReactNode
  className?: string
}

const defaultCountLabel = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'} selected`

/**
 * A pill that rises from the bottom of the screen while a multi-select has items: "2 files selected · Download".
 * It renders in a portal, so a table's overflow cannot clip it. It sits on the `z-nav` layer: a dialog covers it.
 *
 *     <FloatingSelectionBar count={selected.size} itemNoun="file" onDismiss={clear}>
 *       <Button size="compact">Download</Button>
 *     </FloatingSelectionBar>
 */
export function FloatingSelectionBar({
  count,
  onDismiss,
  itemNoun,
  countLabel = defaultCountLabel,
  hint,
  regionLabel = 'Selection actions',
  children,
  className,
}: FloatingSelectionBarProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (count === 0 || !onDismiss) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [count, onDismiss])

  if (!mounted || count === 0) return null

  return createPortal(
    <div
      role="region"
      aria-label={regionLabel}
      className="pointer-events-none fixed inset-x-0 bottom-6 z-nav flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-4 rounded-full border border-line bg-surface py-2 pr-2 pl-6 text-ink',
          'animate-rise-in shadow-float',
          className,
        )}
      >
        <span className="text-body font-semibold tabular-nums">{countLabel(count, itemNoun)}</span>
        {hint && <span className="text-body text-ink-muted">{hint}</span>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
