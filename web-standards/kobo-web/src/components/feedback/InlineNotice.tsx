import * as React from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TONE_CLASS, type Tone } from '../../lib/tone'

type NoticeTone = Exclude<Tone, 'brand'>

const ICON: Record<NoticeTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
}

export interface InlineNoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: NoticeTone
  title?: React.ReactNode
  /** Replace the tone's icon. */
  icon?: LucideIcon
  /** An action under the text, for example a `Button variant="plain" size="compact"`. */
  action?: React.ReactNode
  children?: React.ReactNode
}

/**
 * A toned box in the page flow: a note, a warning or an error. The icon and the words carry the meaning.
 * A danger notice is an alert, so a screen reader reads it when it appears.
 *
 *     <InlineNotice tone="warning" title="Sync is paused">Changes save on this device only.</InlineNotice>
 */
export function InlineNotice({ tone = 'info', title, icon, action, className, children, ...props }: InlineNoticeProps) {
  const Icon = icon ?? ICON[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn('flex gap-3 rounded-control border p-3', TONE_CLASS[tone].container, className)}
      {...props}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', TONE_CLASS[tone].text)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-body text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-muted">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  )
}
