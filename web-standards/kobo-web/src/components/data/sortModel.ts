export type SortDirection = 'asc' | 'desc'

/** The sort of a list: a field and a direction, or none. */
export interface SortState<Field extends string = string> {
  field: Field
  direction: SortDirection
}

export interface SortHeaderInput<Field extends string> {
  field: Field
  activeField: Field | null
  direction: SortDirection
  /** The direction of the first click. */
  defaultDirection: SortDirection
  /** The header can clear the sort with a third click. */
  canClear: boolean
}

/** What one click on a sortable header does. */
export type SortHeaderAction = { kind: 'sort'; direction: SortDirection } | { kind: 'clear' }

/**
 * The next action of a sortable header. The first click applies the default direction, the second flips it,
 * and a third click clears the sort when the header allows it.
 */
export function sortHeaderAction<Field extends string>(input: SortHeaderInput<Field>): SortHeaderAction {
  const active = input.activeField === input.field
  if (!active) return { kind: 'sort', direction: input.defaultDirection }
  if (input.canClear && input.direction !== input.defaultDirection) return { kind: 'clear' }
  return { kind: 'sort', direction: input.direction === 'asc' ? 'desc' : 'asc' }
}

/** The `aria-sort` value of a column header cell. */
export function ariaSort<Field extends string>(
  field: Field,
  activeField: Field | null,
  direction: SortDirection,
): 'ascending' | 'descending' | 'none' {
  if (activeField !== field) return 'none'
  return direction === 'asc' ? 'ascending' : 'descending'
}

type SortValue = string | number | boolean | null | undefined

/** Compares two sort values. Empty values go last in both directions. Numbers compare as numbers. */
export function compareSortValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  const aEmpty = a === null || a === undefined
  const bEmpty = b === null || b === undefined
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  const cmp = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  return direction === 'desc' ? -cmp : cmp
}

/**
 * Sorts rows by one value and keeps pinned rows on top. The order within the pinned rows and within the
 * other rows stays stable. The input array is not changed.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: { value: (row: T) => SortValue; direction: SortDirection } | null,
  pinRow?: (row: T) => boolean,
): T[] {
  const base = sort
    ? [...rows].sort((a, b) => compareSortValues(sort.value(a), sort.value(b), sort.direction))
    : [...rows]
  if (!pinRow) return base
  const pinned = base.filter(pinRow)
  if (pinned.length === 0) return base
  return [...pinned, ...base.filter((row) => !pinRow(row))]
}
