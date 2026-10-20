'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../overlays/Sheet'

/**
 * The widths of a side panel. `max-w-full` keeps the panel inside a phone screen. The `sm:` max width
 * repeats the width, because the sheet's own `sm:max-w-md` would win over a plain `max-w-*`.
 */
export const detailPanelWidths = {
  sm: 'w-[360px] max-w-full sm:max-w-[360px]',
  md: 'w-[400px] max-w-full sm:max-w-[400px]',
  mdWide: 'w-[448px] max-w-full sm:max-w-[448px]',
  lg: 'w-[480px] max-w-full sm:max-w-[480px]',
  xl: 'w-[40vw] min-w-[400px] max-w-full sm:max-w-[40vw]',
} as const

export interface DetailPanelProps {
  open: boolean
  onClose: () => void
  /** The visible title. Without it, the panel has a hidden title (`hiddenTitle`) for a screen reader. */
  title?: string
  /** The spoken title when there is no visible title. */
  hiddenTitle?: string
  children: ReactNode
  className?: string
  contentClassName?: string
  density?: 'default' | 'compact'
  size?: keyof typeof detailPanelWidths
  /** The label of the close button. */
  closeLabel?: string
}

/**
 * The details of one item, in a panel that slides in from the right. Escape, the close button and a
 * click outside close it.
 *
 *     <DetailPanel open={selected !== null} onClose={() => setSelected(null)} title="Trip to Lisbon">
 *       <KeyValueList>…</KeyValueList>
 *     </DetailPanel>
 */
export function DetailPanel({
  open,
  onClose,
  title,
  hiddenTitle = 'Details',
  children,
  className,
  contentClassName,
  density = 'default',
  size = 'md',
  closeLabel = 'Close',
}: DetailPanelProps) {
  const compact = density === 'compact'
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        closeLabel={closeLabel}
        className={cn('flex flex-col p-0', detailPanelWidths[size], className)}
        aria-describedby={undefined}
      >
        {title ? (
          <SheetHeader className={cn('border-b border-line text-left', compact ? 'px-5 py-4 pr-14' : 'px-6 py-5 pr-14')}>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
        ) : (
          <SheetTitle className="sr-only">{hiddenTitle}</SheetTitle>
        )}
        <div className={cn('flex-1 overflow-y-auto', compact ? 'px-5 py-5' : 'px-6 py-6', contentClassName)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
