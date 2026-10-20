'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { CopyButton } from '../controls/CopyButton'
import { maskValue } from './maskValue'

export interface MaskedValueProps {
  /** The full value, or `null` when the viewer may not see it. `null` shows the mask with no controls. */
  value: string | null
  /** The mask to show. By default it is two dots and the last `visible` characters of `value`. */
  mask?: string
  /** The number of trailing characters the default mask shows. */
  visible?: number
  /** Classes for the value text, for example `font-mono`. */
  className?: string
  showLabel?: string
  hideLabel?: string
}

/**
 * A private value, masked until the viewer asks to see it. When it shows, a copy button shows too.
 *
 *     <MaskedValue value="K7Q2-9F4M-X3TB" className="font-mono" />   // ••X3TB, then the full key
 *     <MaskedValue value={null} mask="••X3TB" />                      // no reveal for this viewer
 */
export function MaskedValue({
  value,
  mask,
  visible = 4,
  className,
  showLabel = 'Show value',
  hideLabel = 'Hide value',
}: MaskedValueProps) {
  const [revealed, setRevealed] = React.useState(false)
  const masked = mask ?? (value != null ? maskValue(value, visible) : maskValue('', visible))
  const shown = revealed && value != null

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={className}>{shown ? value : masked}</span>
      {value != null && (
        <button
          type="button"
          onClick={() => setRevealed((prev) => !prev)}
          aria-label={revealed ? hideLabel : showLabel}
          aria-pressed={revealed}
          className={cn(
            'inline-flex rounded-badge text-ink-muted transition-colors duration-(--motion-state) ease-standard hover:text-ink',
            focusRing,
          )}
        >
          {revealed ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
        </button>
      )}
      {shown && <CopyButton value={value} />}
    </span>
  )
}
