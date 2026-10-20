import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'

/** One label and value of a `ReviewSection`. */
export interface ReviewRow {
  label: string
  value: ReactNode
}

export interface ReviewSectionProps {
  title: string
  rows: ReviewRow[]
  /** Shows an Edit button that goes back to the step. */
  onEdit?: () => void
  /** The visible word of the Edit button. A screen reader also hears the title ("Edit Trip details"). */
  editLabel?: string
  className?: string
}

/**
 * A bordered block on a review step: a title, an optional Edit button, and label and value rows. A long value
 * wraps right-aligned and keeps a gap from its label.
 *
 *     <ReviewSection title="Trip details" onEdit={() => goTo('trip')}
 *       rows={[{ label: 'From', value: 'Lisbon' }, { label: 'To', value: 'Porto' }]} />
 */
export function ReviewSection({ title, rows, onEdit, editLabel = 'Edit', className }: ReviewSectionProps) {
  return (
    <section aria-label={title} className={cn('rounded-card border border-line', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {onEdit && (
          <Button variant="plain" size="compact" onClick={onEdit} aria-label={`${editLabel} ${title}`}>
            {editLabel}
          </Button>
        )}
      </div>
      <dl className="flex flex-col gap-3 px-4 py-4">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 text-body">
            <dt className="shrink-0 text-ink-muted">{row.label}</dt>
            <dd className="min-w-0 text-right font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
