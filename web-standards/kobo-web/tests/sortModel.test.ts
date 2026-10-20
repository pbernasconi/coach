import { describe, expect, it } from 'vitest'
import { ariaSort, compareSortValues, sortHeaderAction, sortRows } from '../src/components/data/sortModel'

describe('sortHeaderAction', () => {
  it.each([
    // [activeField, direction, defaultDirection, canClear, expected]
    [null, 'asc', 'asc', false, { kind: 'sort', direction: 'asc' }],
    [null, 'asc', 'desc', false, { kind: 'sort', direction: 'desc' }],
    ['other', 'desc', 'asc', true, { kind: 'sort', direction: 'asc' }],
    ['name', 'asc', 'asc', false, { kind: 'sort', direction: 'desc' }],
    ['name', 'desc', 'asc', false, { kind: 'sort', direction: 'asc' }],
    ['name', 'asc', 'asc', true, { kind: 'sort', direction: 'desc' }],
    ['name', 'desc', 'asc', true, { kind: 'clear' }],
    ['name', 'asc', 'desc', true, { kind: 'clear' }],
  ] as const)('active %s %s, default %s, canClear %s', (activeField, direction, defaultDirection, canClear, expected) => {
    expect(sortHeaderAction({ field: 'name', activeField, direction, defaultDirection, canClear })).toEqual(expected)
  })
})

describe('ariaSort', () => {
  it.each([
    ['name', null, 'asc', 'none'],
    ['name', 'size', 'asc', 'none'],
    ['name', 'name', 'asc', 'ascending'],
    ['name', 'name', 'desc', 'descending'],
  ] as const)('%s with active %s %s → %s', (field, active, direction, expected) => {
    expect(ariaSort(field, active, direction)).toBe(expected)
  })
})

describe('compareSortValues', () => {
  it.each([
    [1, 2, 'asc', -1],
    [10, 9, 'asc', 1],
    [1, 2, 'desc', 1],
    ['a', 'b', 'asc', -1],
    [null, 'b', 'asc', 1],
    [null, 'b', 'desc', 1],
    ['a', undefined, 'desc', -1],
    [null, null, 'asc', 0],
  ] as const)('%s vs %s %s', (a, b, direction, sign) => {
    expect(Math.sign(compareSortValues(a, b, direction))).toBe(sign)
  })
})

describe('sortRows', () => {
  const rows = [
    { id: 'a', size: 3 },
    { id: 'b', size: 1 },
    { id: 'c', size: 2 },
  ]

  it('sorts without changing the input', () => {
    const sorted = sortRows(rows, { value: (row) => row.size, direction: 'asc' })
    expect(sorted.map((row) => row.id)).toEqual(['b', 'c', 'a'])
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps pinned rows on top, whatever the sort', () => {
    const sorted = sortRows(rows, { value: (row) => row.size, direction: 'desc' }, (row) => row.id === 'b')
    expect(sorted.map((row) => row.id)).toEqual(['b', 'a', 'c'])
  })

  it('keeps the input order with no sort', () => {
    expect(sortRows(rows, null).map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })
})
