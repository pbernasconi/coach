import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SuccessStateProps {
  title: string
  description?: string
  /** One way forward: a button or a link. */
  action?: ReactNode
  /** The heading level of the title. Use the level that fits the page outline. */
  headingLevel?: 2 | 3 | 4
  className?: string
}

/**
 * The end of a flow that worked: a check, a title and one way forward.
 *
 *     <SuccessState title="Invite sent" description="We sent an invite to rosa@example.com."
 *       action={<Button variant="outline" size="compact">Send another</Button>} />
 */
export function SuccessState({ title, description, action, headingLevel = 3, className }: SuccessStateProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <CircleCheck aria-hidden="true" className="mb-3 size-10 text-brand-ink" />
      <Heading className="text-title2 text-ink">{title}</Heading>
      {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
