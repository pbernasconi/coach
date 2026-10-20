import * as React from 'react'
import { cn } from '../../lib/cn'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons on the right (under the title on a phone). */
  actions?: React.ReactNode
  className?: string
}

/**
 * The title block at the top of a page: an `h1`, an optional line of text and the page actions.
 *
 *     <PageHeader title="Notes" description="Everything you wrote this month." actions={<Button>New note</Button>} />
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">{title}</h1>
        {description && <p className="text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  )
}
