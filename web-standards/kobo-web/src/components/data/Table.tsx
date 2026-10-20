import * as React from 'react'
import { cn } from '../../lib/cn'

/** Right-aligned tabular digits, so a column of numbers lines up. */
const numericCell = 'text-right tabular-nums'

/**
 * A plain data table. It scrolls sideways when it is wider than its container.
 *
 *     <Table>
 *       <TableHeader><TableRow><TableHead>Name</TableHead><TableHead numeric>Size</TableHead></TableRow></TableHeader>
 *       <TableBody><TableRow><TableCell>notes.txt</TableCell><TableCell numeric>12 KB</TableCell></TableRow></TableBody>
 *     </Table>
 */
export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-body text-ink', className)} {...props} />
    </div>
  )
}

/** The header rows of a table. */
export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

/** The body rows of a table. The last row has no bottom border. */
export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

/** The footer rows of a table, for totals. */
export function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      className={cn('border-t border-line bg-surface-raised/50 font-semibold [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

/** One row. `data-state="selected"` tints it. */
export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-line transition-colors duration-(--motion-state) ease-standard',
        'hover:bg-surface-raised/50 data-[state=selected]:bg-surface-sunken',
        className,
      )}
      {...props}
    />
  )
}

export interface TableHeadProps extends React.ComponentProps<'th'> {
  /** A column of numbers: right-aligned, with tabular digits. */
  numeric?: boolean
}

/** A column header cell. */
export function TableHead({ className, numeric = false, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'h-10 px-2 text-left align-middle font-semibold text-ink-muted',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        numeric && numericCell,
        className,
      )}
      {...props}
    />
  )
}

export interface TableCellProps extends React.ComponentProps<'td'> {
  /** A number: right-aligned, with tabular digits. */
  numeric?: boolean
}

/** A data cell. */
export function TableCell({ className, numeric = false, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        numeric && numericCell,
        className,
      )}
      {...props}
    />
  )
}

/** The caption under a table. It names the table for a screen reader. */
export function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('mt-4 text-body text-ink-muted', className)} {...props} />
}
