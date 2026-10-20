'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../overlays/Tooltip'

export interface TruncatedTextProps {
  /** The text. An empty value shows `empty` in place of a blank cell. */
  children?: React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** What an empty value shows. */
  empty?: React.ReactNode
}

function isClipped(element: HTMLElement | null): boolean {
  return element != null && element.scrollWidth > element.clientWidth
}

/**
 * One line of text that shows its full value in a tooltip, but only when the line is clipped.
 * A tooltip that repeats text the reader can already see is noise. An empty value shows an em dash.
 * The block can shrink (`min-w-0`), so long text never paints into the next grid cell.
 *
 *     <TruncatedText className="max-w-48">{note.title}</TruncatedText>
 */
export function TruncatedText({ children, className, side = 'top', empty = '—' }: TruncatedTextProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)

  if (children === null || children === undefined || children === '') {
    return <span className="text-ink-faint">{empty}</span>
  }

  return (
    <TooltipProvider>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          if (next && !isClipped(ref.current)) return
          setOpen(next)
        }}
      >
        <TooltipTrigger asChild>
          <span ref={ref} className={cn('block min-w-0 truncate', className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent variant="standard" side={side} className="max-w-72">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
