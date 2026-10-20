import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Spinner } from '../controls/Spinner'

const BADGE = {
  brand: 'bg-brand-soft text-brand-ink',
  neutral: 'bg-surface-raised text-ink-muted',
  danger: 'bg-danger-soft text-danger-ink',
} as const

/** The badge glyph: a status icon, or the spinner while the state still loads. */
type StatusCardGlyph = { icon: LucideIcon; spin?: false } | { icon?: undefined; spin: true }

export type StatusCardProps = StatusCardGlyph & {
  tone?: keyof typeof BADGE
  title: string
  /** The heading level of the title. Use the level that fits the page outline. */
  headingLevel?: 1 | 2 | 3
  children?: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * A centred card with a round icon badge, for a full-page state: a link that expired, "we sent you a new
 * one", a paused profile. The title carries the meaning; the badge is decorative.
 *
 *     <StatusCard icon={MailCheck} title="We sent you a new link">Check your inbox.</StatusCard>
 *     <StatusCard tone="neutral" spin title="Checking your link" />
 */
export function StatusCard({ tone = 'brand', title, headingLevel = 2, children, action, className, ...glyph }: StatusCardProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div className={cn('rounded-card bg-surface text-ink shadow-card', className)}>
      <div className="flex flex-col items-center gap-3 p-6">
        <div className={cn('flex size-12 items-center justify-center rounded-full', BADGE[tone])}>
          {glyph.spin ? <Spinner size="xl" /> : <glyph.icon aria-hidden="true" className="size-6" />}
        </div>
        <Heading className="text-center text-title2 text-ink">{title}</Heading>
      </div>
      {(children || action) && (
        <div className="px-6 pb-6 text-center text-body text-ink-muted">
          {children}
          {action && <div className="mt-6">{action}</div>}
        </div>
      )}
    </div>
  )
}
