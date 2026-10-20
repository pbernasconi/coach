import { describe, expect, it } from 'vitest'
import { LOAD_MORE_COPY, loadMoreModel, pageFooterAction, type PageInfo } from '../src/components/data/loadMoreModel'
import vector from './vectors/list-page-info.json'

describe('pageFooterAction (list-page-info vector)', () => {
  it.each(vector.cases)('$name', ({ pageInfo, expected }) => {
    expect(pageFooterAction(pageInfo as PageInfo)).toBe(expected)
  })
})

describe('loadMoreModel', () => {
  it.each([
    ['more to load', { hasMore: true }, { countLine: null, ceiling: null, failed: false, button: { label: 'Load more', action: 'loadMore' } }],
    ['end of list', { hasMore: false }, { countLine: null, ceiling: null, failed: false, button: null }],
    [
      'failure keeps a retry even with no cursor',
      { hasMore: false, error: new Error('x') },
      { countLine: null, ceiling: null, failed: true, button: { label: 'Try again', action: 'retry' } },
    ],
    [
      'ceiling after the last cursor',
      { hasMore: false, bounded: true },
      { countLine: null, ceiling: LOAD_MORE_COPY.ceiling, failed: false, button: null },
    ],
    ['no ceiling while a cursor is left', { hasMore: true, bounded: true }, { ceiling: null }],
    ['count with a total', { hasMore: false, count: { loaded: 50, total: 212 } }, { countLine: 'Showing 50 of 212' }],
    ['count with no total', { hasMore: false, count: { loaded: 50, total: null } }, { countLine: 'Showing 50' }],
    ['summary wins over count', { hasMore: false, summary: '3 notes', count: { loaded: 1, total: 1 } }, { countLine: '3 notes' }],
    ['false is not an error', { hasMore: true, error: false }, { failed: false }],
  ] as const)('%s', (_, input, expected) => {
    expect(loadMoreModel(input)).toMatchObject(expected)
  })

  it('uses the caller words', () => {
    const model = loadMoreModel({ hasMore: true }, { ...LOAD_MORE_COPY, loadMore: 'See more trips' })
    expect(model.button?.label).toBe('See more trips')
  })
})
