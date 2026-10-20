import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { TONE_CLASS, type Tone } from '../../lib/tone'

export type TimelineTone = Exclude<Tone, 'brand'>

/** One step of a `Timeline`. */
export interface TimelineStep {
  /** The words of the step. They carry the meaning, never the colour alone. */
  label: string
  /** The time, already formatted for people ("Jul 7, 9:00 AM"). */
  time?: string | null
  /** The machine time of the step (ISO 8601), for the `<time>` element. */
  dateTime?: string
  tone: TimelineTone
  /** The step the item is on now. A screen reader says "current step". */
  current?: boolean
}

export interface TimelineProps {
  steps: TimelineStep[]
  variant?: 'default' | 'compact'
  /** The small heading over the list. Pass `null` to hide it. */
  title?: ReactNode
  className?: string
}

const RING: Record<TimelineTone, string> = {
  neutral: 'ring-neutral-soft',
  info: 'ring-info-soft',
  success: 'ring-success-soft',
  warning: 'ring-warning-soft',
  danger: 'ring-danger-soft',
}

/**
 * A vertical list of the steps of something that moves through states, with a toned dot, a label and a time.
 * A failure is a danger step, not the current step.
 *
 *     <Timeline steps={[
 *       { label: 'Booked', time: 'Jul 7, 9:00 AM', tone: 'success' },
 *       { label: 'Checked in', tone: 'info', current: true },
 *       { label: 'Landed', tone: 'neutral' },
 *     ]} />
 */
export function Timeline({ steps, variant = 'default', title = 'Timeline', className }: TimelineProps) {
  const compact = variant === 'compact'
  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3', className)} data-variant={variant}>
      {title !== null && <p className="text-footnote font-semibold tracking-wide text-ink-muted uppercase">{title}</p>}
      <ol>
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <li
              key={`${step.label}-${index}`}
              className={cn('flex', compact ? 'gap-3' : 'gap-4')}
              data-tone={step.tone}
              aria-current={step.current ? 'step' : undefined}
            >
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 shrink-0 rounded-full',
                    compact ? 'size-2' : 'size-2.5',
                    TONE_CLASS[step.tone].solid,
                    step.current && 'ring-4',
                    step.current && RING[step.tone],
                  )}
                />
                {!last && <span aria-hidden="true" className="w-px flex-1 bg-line" />}
              </div>
              <div
                className={cn(
                  'flex min-w-0 flex-1 items-baseline justify-between text-body',
                  compact ? 'gap-3' : 'gap-5',
                  last ? 'pb-0' : compact ? 'pb-3' : 'pb-4',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 font-semibold break-words',
                    step.tone === 'success' ? 'text-ink' : TONE_CLASS[step.tone].text,
                  )}
                >
                  {step.label}
                </span>
                {step.time && (
                  <time dateTime={step.dateTime} className="shrink-0 text-ink-muted tabular-nums">
                    {step.time}
                  </time>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
