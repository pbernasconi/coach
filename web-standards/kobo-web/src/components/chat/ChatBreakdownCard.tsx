import * as React from 'react'
import { cn } from '../../lib/cn'
import { barFractions } from './breakdownBars'

/** The data colours a breakdown bar can take. */
const SWATCH = {
  1: 'bg-viz-1', 2: 'bg-viz-2', 3: 'bg-viz-3', 4: 'bg-viz-4', 5: 'bg-viz-5', 6: 'bg-viz-6', 7: 'bg-viz-7', 8: 'bg-viz-8',
} as const

export type ChatBreakdownRow = { label: string; value: number; display: string; swatch?: keyof typeof SWATCH; icon?: React.ReactNode }

export interface ChatBreakdownCardProps {
  /** A quiet line on top ("October 2026"). */
  caption?: string | null
  title: string
  /** The big number ("14 h 20 m"). */
  total: string
  rows: ChatBreakdownRow[]
  /** Buttons or links under the bars ("Open the plan"). */
  action?: React.ReactNode
  className?: string
}

/**
 * A data card in a chat: a caption, a big total, and a bar per part, biggest first. A bar is the part over the biggest
 * part; each row also shows its value in words, so the colours are never the only cue.
 *
 *     <ChatBreakdownCard caption="This week" title="Time by project" total="14 h" rows={rows} />
 */
export function ChatBreakdownCard({ caption, title, total, rows, action, className }: ChatBreakdownCardProps) {
  const fractions = barFractions(rows.map((r) => r.value))
  return (
    <section aria-label={title} className={cn('w-full rounded-card border border-line bg-surface p-4', className)}>
      {caption && <p className="text-footnote text-ink-muted">{caption}</p>}
      <h3 className="text-subhead text-ink-muted">{title}</h3>
      <p className="mt-0.5 text-title text-ink tabular-nums">{total}</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <li key={row.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-subhead text-ink">
              {row.icon && <span aria-hidden="true" className="text-ink-muted [&_svg]:size-3.5">{row.icon}</span>}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-raised">
              <span
                className={cn('block h-full rounded-full', SWATCH[row.swatch ?? (((i % 8) + 1) as keyof typeof SWATCH)])}
                style={{ width: `${Math.round((fractions[i] ?? 0) * 100)}%` }}
              />
            </span>
            <span className="text-subhead text-ink-muted tabular-nums">{row.display}</span>
          </li>
        ))}
      </ul>
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </section>
  )
}
