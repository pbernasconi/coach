import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ReviewDisclosureProps {
  children: ReactNode
  className?: string
}

/**
 * The fine print over the main action of a review step. It says what the action agrees to.
 *
 *     <ReviewDisclosure>When you select Publish, the page is visible to everyone with the link.</ReviewDisclosure>
 */
export function ReviewDisclosure({ children, className }: ReviewDisclosureProps) {
  return <p className={cn('text-footnote leading-5 text-pretty text-ink-muted', className)}>{children}</p>
}
