import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

export interface BreadcrumbItem {
  label: string
  /** A plain link. */
  href?: string
  /**
   * A link element from the app's router, used in place of `<a href>`. The label goes inside it.
   * `{ label: 'Notes', link: <RouterLink to="/notes" /> }`
   */
  link?: React.ReactElement
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** The name of the nav landmark. */
  label?: string
  className?: string
}

const linkClass = cn('truncate rounded-badge text-ink-muted transition-colors duration-(--motion-state) ease-standard hover:text-brand-ink', focusRing)

/**
 * The trail of pages above the current one. Every item but the last is a link; the last is the current page.
 *
 *     <Breadcrumb items={[{ label: 'Trips', href: '/trips' }, { label: 'Lisbon' }]} />
 */
export function Breadcrumb({ items, label = 'Breadcrumb', className }: BreadcrumbProps) {
  return (
    <nav aria-label={label} className={cn('text-body', className)}>
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const linked = !isLast && (item.link || item.href)
          return (
            <li key={index} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-ink-muted" />}
              {!linked ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn('truncate', isLast ? 'font-semibold text-ink' : 'text-ink-muted')}
                >
                  {item.label}
                </span>
              ) : item.link ? (
                <Slot className={linkClass}>{React.cloneElement(item.link, undefined, item.label)}</Slot>
              ) : (
                <a href={item.href} className={linkClass}>
                  {item.label}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
