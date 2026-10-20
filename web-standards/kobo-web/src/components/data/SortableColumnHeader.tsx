import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { StandardTooltip } from '../overlays/StandardTooltip'
import { sortHeaderAction, type SortDirection } from './sortModel'

export interface SortableColumnHeaderProps<Field extends string> {
  field: Field
  label: ReactNode
  /** The spoken name of the column, when `label` is not plain text. */
  accessibleLabel?: string
  activeField: Field | null
  direction: SortDirection
  onSortChange: (field: Field, direction: SortDirection) => void
  /** Allow a third click that clears the sort. */
  onClearSort?: () => void
  /** The direction of the first click: dates newest first (`desc`), names A to Z (`asc`). */
  defaultDirection?: SortDirection
  /** The spoken words for each direction ("low to high"). */
  directionLabels?: { asc: string; desc: string }
  align?: 'left' | 'right'
  /** Make the whole header cell the click target. The `TableHead` must be `relative`. */
  fillCell?: boolean
  /** Show a faint arrow on hover on a column that is not sorted. */
  showInactiveIcon?: boolean
  /** The spoken action to sort, for example "Sort by Name, ascending". */
  sortLabel?: (column: string, direction: string) => string
  /** The spoken action to clear the sort. */
  clearLabel?: (column: string) => string
  className?: string
}

/**
 * A column header button that sorts a list, with a tooltip that says what the next click does. Put it in a `TableHead` that has `aria-sort={ariaSort(…)}`.
 * The first click applies the default direction and a second click flips it.
 *
 *     <TableHead aria-sort={ariaSort('name', sort.field, sort.direction)}>
 *       <SortableColumnHeader field="name" label="Name" activeField={sort.field} direction={sort.direction}
 *         onSortChange={(field, direction) => setSort({ field, direction })} />
 *     </TableHead>
 */
export function SortableColumnHeader<Field extends string>({
  field,
  label,
  accessibleLabel,
  activeField,
  direction,
  onSortChange,
  onClearSort,
  defaultDirection = 'asc',
  directionLabels = { asc: 'ascending', desc: 'descending' },
  align = 'left',
  fillCell = false,
  showInactiveIcon = true,
  sortLabel = (column, word) => `Sort by ${column}, ${word}`,
  clearLabel = (column) => `Clear sorting by ${column}`,
  className,
}: SortableColumnHeaderProps<Field>) {
  const active = activeField === field
  const action = sortHeaderAction({ field, activeField, direction, defaultDirection, canClear: Boolean(onClearSort) })
  const column = accessibleLabel ?? (typeof label === 'string' ? label : field)
  const actionLabel =
    action.kind === 'clear' ? clearLabel(column) : sortLabel(column, directionLabels[action.direction].toLowerCase())

  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown
  // The faint arrow of a column that is not sorted shows on hover. It previews the first click.
  const GhostIcon = defaultDirection === 'asc' ? ArrowUp : ArrowDown
  const icon = active ? (
    <DirectionIcon aria-hidden="true" className="size-3 shrink-0" />
  ) : showInactiveIcon ? (
    <GhostIcon
      aria-hidden="true"
      className="size-3 shrink-0 opacity-0 transition-opacity duration-(--motion-state) ease-standard group-hover:opacity-50 group-focus-visible:opacity-50"
    />
  ) : null

  return (
    <StandardTooltip content={actionLabel}>
      <button
      type="button"
      onClick={() => (action.kind === 'clear' ? onClearSort?.() : onSortChange(field, action.direction))}
      aria-label={actionLabel}
      aria-pressed={active}
      className={cn(
        'group flex min-w-0 cursor-pointer items-center gap-1 text-footnote font-semibold',
        'transition-colors duration-(--motion-state) ease-standard hover:text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        fillCell
          ? 'absolute inset-0 h-full w-full rounded-none px-2 hover:bg-surface-raised focus-visible:z-sticky focus-visible:ring-inset'
          : '-my-2 rounded-inner py-2',
        // A right-aligned column needs a full-width button to align against. The icon moves to the left,
        // so the label stays flush with the numbers under it and does not move when the icon shows.
        align === 'right' && 'w-full justify-end text-right',
        active ? 'text-ink' : 'text-ink-muted',
        className,
      )}
    >
      {align === 'right' && icon}
      <span className="truncate">{label}</span>
      {align !== 'right' && icon}
      </button>
    </StandardTooltip>
  )
}
