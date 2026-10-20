import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** One way forward: a button or a link. */
  action?: React.ReactNode
  /** Fill the free height of the page and centre the content. */
  fullPage?: boolean
  /** The heading level of the title. Use the level that fits the page outline. */
  headingLevel?: 2 | 3 | 4
  className?: string
}

/**
 * The state of a list or a page with nothing in it. Say what is missing and give one way forward.
 *
 *     <EmptyState icon={Inbox} title="No notes yet" description="Notes you add show here." action={<Button>Add a note</Button>} />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  fullPage = false,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-gutter text-center',
        fullPage ? 'min-h-[60dvh]' : 'py-12',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-raised">
          <Icon aria-hidden="true" className="size-6 text-ink-muted" />
        </div>
      )}
      <Heading className="text-headline text-ink">{title}</Heading>
      {description && <p className="mt-1 max-w-sm text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
