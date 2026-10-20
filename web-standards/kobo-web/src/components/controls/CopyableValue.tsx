import * as React from 'react'
import { cn } from '../../lib/cn'
import { CopyButton } from './CopyButton'

export interface CopyableValueProps {
  /** The raw value that goes to the clipboard. */
  value: string
  /** A formatted display, such as a spaced phone number. By default it is `value`. */
  display?: React.ReactNode
  /** Monospace the value. On for codes and IDs; off for prose such as a phone number. */
  mono?: boolean
  /**
   * The side of the copy button. `trailing` (the default) suits left-aligned text. `leading` keeps the
   * value flush to the end of a right-aligned row, so the text does not move.
   */
  iconPosition?: 'leading' | 'trailing'
  className?: string
}

/**
 * A value that is safe to show, with a copy button.
 *
 *     <CopyableValue value="INV-20431" />
 *     <CopyableValue value="+15551234567" display="+1 555 123 4567" mono={false} iconPosition="leading" />
 */
export function CopyableValue({ value, display, mono = true, iconPosition = 'trailing', className }: CopyableValueProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {iconPosition === 'leading' && <CopyButton value={value} />}
      <span className={cn('truncate', mono && 'font-mono', className)}>{display ?? value}</span>
      {iconPosition === 'trailing' && <CopyButton value={value} />}
    </span>
  )
}
