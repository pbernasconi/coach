import * as React from 'react'
import { cn } from '../../lib/cn'
import { TONE_CLASS, type Tone } from '../../lib/tone'

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** An optional leading icon. The text carries the meaning, so the icon is decorative. */
  icon?: React.ReactNode
  children: React.ReactNode
}

/**
 * A short toned label for a status ("Active", "Overdue"). The words carry the meaning, never the colour alone.
 *
 *     <StatusPill tone="success">Paid</StatusPill>
 */
export function StatusPill({ tone = 'neutral', icon, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge border px-2 py-0.5 text-footnote font-semibold whitespace-nowrap',
        TONE_CLASS[tone].container,
        TONE_CLASS[tone].text,
        '[&_svg]:size-3 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon && <span aria-hidden="true" className="contents">{icon}</span>}
      {children}
    </span>
  )
}
