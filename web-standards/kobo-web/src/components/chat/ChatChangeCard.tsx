'use client'

import * as React from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { StatusPill } from '../feedback/StatusPill'
import { CHANGE_TAG_TONE, applyLabel, changeStatusPill, type ChatChangeDay, type ChatChangeStatus } from './changeCard'

export interface ChatChangeCardProps {
  title: string
  /** One line under the title ("3 changes · Tue to Wed"). */
  summary?: string | null
  /** The rows by day, as they will be after Apply. */
  days: ChatChangeDay[]
  /** Rules the change breaks that the person asked for anyway. */
  warnings?: string[]
  /** A quiet check line ("Checked against your plan: no clashes"). */
  checked?: string | null
  status: ChatChangeStatus
  /** How many changes Apply makes, when it isn't the number of rows. */
  count?: number | null
  /** What happened at Apply or Undo when it isn't simply what the card showed. */
  result?: string[]
  /** Which button is working. Both buttons wait while one is. */
  pending?: 'apply' | 'dismiss' | 'undo' | null
  onApply?: () => void
  onDismiss?: () => void
  onUndo?: () => void
  /** Undo would leave some rows as the person set them since: ask first. */
  undoConfirm?: { message: string; count: number; onConfirm: () => void; onCancel: () => void } | null
  className?: string
}

/**
 * A set of changes the assistant proposes, for the person to Apply or turn down: a title, the rows by day with one
 * quiet tag each ("From Sat", "New", "Skipped"), any warnings, then Not now / Apply N changes. After Apply the card
 * says so and offers Undo; Undo asks first when some rows were changed since.
 *
 *     <ChatChangeCard title="Move the review" days={days} status="open" onApply={apply} onDismiss={dismiss} />
 */
export function ChatChangeCard({
  title, summary, days, warnings = [], checked, status, count, result = [], pending = null,
  onApply, onDismiss, onUndo, undoConfirm, className,
}: ChatChangeCardProps) {
  const pill = changeStatusPill(status)
  const busy = pending !== null
  return (
    <section
      aria-label={title}
      className={cn('w-full rounded-card border border-line bg-surface p-4', status !== 'open' && status !== 'applied' && 'opacity-80', className)}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-headline text-ink">{title}</h3>
          {summary && <p className="text-footnote text-ink-muted">{summary}</p>}
        </div>
        {pill && <StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
      </header>

      <div className="mt-3 flex flex-col gap-3">
        {days.map((day) => (
          <div key={day.label}>
            <h4 className="text-caption font-semibold tracking-wide text-ink-muted uppercase">{day.label}</h4>
            <ul className="mt-1 divide-y divide-line">
              {day.rows.map((row, i) => (
                <li key={`${row.title}-${i}`} className="flex items-center gap-2.5 py-2">
                  {row.icon && <span aria-hidden="true" className="text-ink-muted [&_svg]:size-4">{row.icon}</span>}
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-body text-ink', row.tone === 'skip' && 'text-ink-muted line-through decoration-ink-faint')}>{row.title}</p>
                    {row.meta && <p className="truncate text-footnote text-ink-muted">{row.meta}</p>}
                  </div>
                  {row.tag && <StatusPill tone={CHANGE_TAG_TONE[row.tone ?? 'change']}>{row.tag}</StatusPill>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {warnings.map((w) => (
            <li key={w} className="flex gap-1.5 text-footnote text-warning-ink">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
      {checked && status === 'open' && (
        <p className="mt-3 flex items-center gap-1.5 text-footnote text-ink-muted">
          <Check aria-hidden="true" className="size-3.5 text-success-ink" />
          {checked}
        </p>
      )}
      {result.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-footnote text-ink-muted">
          {result.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      {status === 'open' && (onApply || onDismiss) && (
        <div className="mt-4 flex justify-end gap-2">
          {onDismiss && (
            <Button variant="secondary" size="compact" onClick={onDismiss} disabled={busy} loading={pending === 'dismiss'}>
              Not now
            </Button>
          )}
          {onApply && (
            <Button size="compact" onClick={onApply} disabled={busy} loading={pending === 'apply'}>
              {applyLabel(days, count)}
            </Button>
          )}
        </div>
      )}
      {status === 'applied' && onUndo && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {undoConfirm ? (
            <>
              <p role="alert" className="mr-auto text-footnote text-ink-muted">{undoConfirm.message}</p>
              <Button variant="secondary" size="compact" onClick={undoConfirm.onCancel} disabled={busy}>Keep</Button>
              <Button variant="outline" size="compact" onClick={undoConfirm.onConfirm} loading={pending === 'undo'}>
                Undo {undoConfirm.count}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="compact" onClick={onUndo} loading={pending === 'undo'}>Undo</Button>
          )}
        </div>
      )}
    </section>
  )
}
