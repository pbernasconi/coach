'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { isAtLimit } from './characterLimit'
import { Textarea } from './Textarea'

export interface CountedTextareaProps extends Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  /** The limit. The textarea stops input at this length. */
  maxLength: number
  /** One help line, on the left of the counter. */
  helper?: React.ReactNode
}

/**
 * A textarea with a help line and a character counter under it. The counter ("45/80") is always visible and turns
 * to the danger tone at the limit.
 *
 *     <CountedTextarea aria-label="Note" value={note} onChange={setNote} maxLength={80} helper="Only you see it." />
 */
export function CountedTextarea({ value, onChange, maxLength, helper, className, id, ...props }: CountedTextareaProps) {
  const helperId = React.useId()
  const counterId = React.useId()
  const atLimit = isAtLimit(value.length, maxLength)
  return (
    <div className="flex flex-col gap-1">
      <Textarea
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={cn(helper ? helperId : undefined, counterId)}
        className={className}
        {...props}
      />
      <div className="flex items-start justify-between gap-3 text-footnote text-ink-muted">
        <span id={helperId}>{helper}</span>
        <span
          id={counterId}
          data-at-limit={atLimit || undefined}
          className={cn('shrink-0 tabular-nums', atLimit && 'font-semibold text-danger-ink')}
        >
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}
