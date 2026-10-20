'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { clickableRowProps } from './clickableRow'
import { SortableColumnHeader } from './SortableColumnHeader'
import { ariaSort, sortRows, type SortState } from './sortModel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table'

type SortValue = string | number | boolean | null

/** One column of a `DataTable`. */
export interface DataTableColumn<T> {
  /** A unique id. Without `render`, the cell shows `row[key]`. */
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  /** The value to sort by. The default is `row[key]`. */
  sortValue?: (row: T) => SortValue
  /** A column of numbers: right-aligned, with tabular digits. */
  numeric?: boolean
  className?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** A stable key for a row. The default is the row's position, which is not stable when the table sorts. */
  getRowKey?: (row: T) => string
  onRowClick?: (row: T) => void
  /** The spoken name of a clickable row. The default is "Open row N". */
  getRowAriaLabel?: (row: T) => string
  isRowClickable?: (row: T) => boolean
  isRowSelected?: (row: T) => boolean
  getRowClassName?: (row: T) => string | undefined
  /** What the table shows with no rows: words or an `EmptyState`. */
  emptyState?: ReactNode
  className?: string
  density?: 'default' | 'compact'
  defaultSort?: SortState
  /** Tint rows on hover even when they are not clickable. It helps the eye follow a wide row. */
  hoverable?: boolean
  /** Rows that stay on top whatever the sort, for example the signed-in person's own row. */
  pinRow?: (row: T) => boolean
}

const cellOf = (row: object, key: string): unknown => (row as Record<string, unknown>)[key]

/**
 * A table of rows from plain column definitions, with sort on click, clickable and selected rows, and an
 * empty state. Wrap it in `QueryBoundary` for the loading and error states.
 *
 *     <DataTable
 *       columns={[{ key: 'name', header: 'Name', sortable: true }, { key: 'size', header: 'Size', numeric: true }]}
 *       data={files}
 *       getRowKey={(file) => file.id}
 *       onRowClick={(file) => open(file.id)}
 *     />
 */
export function DataTable<T extends object>({
  columns,
  data,
  getRowKey,
  onRowClick,
  getRowAriaLabel,
  isRowClickable,
  isRowSelected,
  getRowClassName,
  emptyState = 'No results found',
  className,
  density = 'default',
  defaultSort,
  hoverable = false,
  pinRow,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null)

  const rows = useMemo(() => {
    const column = sort ? columns.find((c) => c.key === sort.field) : undefined
    const value = column?.sortValue ?? ((row: T) => cellOf(row, sort?.field ?? '') as SortValue)
    return sortRows(data, sort && column ? { value, direction: sort.direction } : null, pinRow)
  }, [data, sort, columns, pinRow])

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead
              key={col.key}
              numeric={col.numeric}
              aria-sort={col.sortable ? ariaSort(col.key, sort?.field ?? null, sort?.direction ?? 'asc') : undefined}
              className={cn('text-footnote font-normal', density === 'compact' && 'h-8 py-0', col.className)}
            >
              {col.sortable ? (
                <SortableColumnHeader
                  field={col.key}
                  label={col.header}
                  activeField={sort?.field ?? null}
                  direction={sort?.direction ?? 'asc'}
                  align={col.numeric ? 'right' : 'left'}
                  onSortChange={(field, direction) => setSort({ field, direction })}
                  onClearSort={() => setSort(null)}
                />
              ) : (
                col.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-12 text-center text-body text-ink-muted">
              {emptyState}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, index) => {
            const clickable = Boolean(onRowClick) && (isRowClickable ? isRowClickable(row) : true)
            const selected = isRowSelected?.(row) ?? false
            const interaction =
              clickable && onRowClick
                ? {
                    ...clickableRowProps(() => onRowClick(row)),
                    'aria-label': getRowAriaLabel?.(row) ?? `Open row ${index + 1}`,
                  }
                : {}
            return (
              <TableRow
                key={getRowKey?.(row) ?? index}
                data-state={selected ? 'selected' : undefined}
                {...interaction}
                className={cn(
                  'border-b border-line/50 last:border-b-0',
                  selected && 'bg-surface-sunken hover:bg-surface-sunken',
                  clickable &&
                    'cursor-pointer hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  !clickable && !hoverable && 'hover:bg-transparent',
                  !clickable && hoverable && 'hover:bg-surface-raised/30',
                  getRowClassName?.(row),
                )}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    numeric={col.numeric}
                    className={cn(density === 'compact' ? 'py-2' : 'py-3', col.className)}
                  >
                    {col.render ? col.render(row) : (cellOf(row, col.key) as ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
