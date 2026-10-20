import * as React from 'react'
import { cn } from '../../lib/cn'

/**
 * A surface that groups related content. Depth comes from tone and a soft shadow, not a border.
 *
 *     <Card>
 *       <CardHeader><CardTitle>Trip to Lisbon</CardTitle><CardDescription>3 days</CardDescription></CardHeader>
 *       <CardContent>…</CardContent>
 *       <CardFooter><Button>Open</Button></CardFooter>
 *     </Card>
 */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-card bg-surface text-ink shadow-card', className)} {...props} />
}

/** The title and description block at the top of a card. */
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-card', className)} {...props} />
}

/** The title of a card. It is an `h3`. */
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-headline text-ink', className)} {...props} />
}

/** The supporting text under the card title. */
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-body text-ink-muted', className)} {...props} />
}

/** The main content of a card. */
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-card pb-card', className)} {...props} />
}

/** The actions row at the bottom of a card. */
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 px-card pb-card', className)} {...props} />
}
