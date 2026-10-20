'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useKeyValueRowDensity, type KeyValueRowDensity } from './KeyValueList'

export interface KeyValueRowProps {
  label: string
  description?: string
  value?: ReactNode
  /** One control at the end of the row, for example an Edit button. */
  action?: ReactNode
  /** The default comes from the `KeyValueList`. */
  density?: KeyValueRowDensity
  className?: string
}

/** One label and value row: stacked on a phone, side by side from `sm` up. Put it in a `KeyValueList`. */
export function KeyValueRow({ label, description, value, action, density, className }: KeyValueRowProps) {
  const inherited = useKeyValueRowDensity()
  const resolved = density ?? inherited
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-line py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8',
        resolved === 'comfortable' && 'min-h-[88px]',
        className,
      )}
    >
      <div className="w-full shrink-0 sm:w-[45%]">
        <p className="text-body text-ink">{label}</p>
        {description && <p className="mt-0.5 text-footnote text-ink-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        {value !== null && value !== undefined && <div className="min-w-0 flex-1 text-left text-body text-ink">{value}</div>}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
