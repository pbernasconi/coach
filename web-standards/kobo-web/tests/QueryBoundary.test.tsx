import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { classifyError, EmptyState, QueryBoundary, type QueryLike } from '../src'

const query = <T,>(overrides: Partial<QueryLike<T>>): QueryLike<T> => ({
  data: undefined,
  error: null,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  ...overrides,
})

const renderBoundary = (q: QueryLike<string[]>) =>
  render(
    <QueryBoundary
      query={q}
      errorTitle="We could not load your notes"
      isEmpty={(items) => items.length === 0}
      empty={<EmptyState title="No notes yet" />}
    >
      {(items) => <p>{items.join(', ')}</p>}
    </QueryBoundary>,
  )

describe('QueryBoundary', () => {
  it('announces one loading status', () => {
    renderBoundary(query({}))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('shows a retryable error with Try again, which refetches', async () => {
    const refetch = vi.fn()
    renderBoundary(query({ isError: true, error: new Error('boom'), refetch }))
    expect(screen.getByRole('heading', { name: 'We could not load your notes' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('shows a permission failure with no retry', () => {
    renderBoundary(query({ isError: true, error: { status: 403 } }))
    expect(screen.getByRole('heading', { name: 'You do not have access to this' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the empty state', () => {
    renderBoundary(query({ data: [] }))
    expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument()
  })

  it('keeps the data on the screen when a background refetch fails', () => {
    renderBoundary(query({ data: ['Groceries', 'Trip'], isError: true, error: new Error('boom') }))
    expect(screen.getByText('Groceries, Trip')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('classifyError', () => {
  it.each([
    [{ status: 403 }, 'permission'],
    [{ data: { code: 'FORBIDDEN' } }, 'permission'],
    [{ status: 404 }, 'not-found'],
    [{ data: { httpStatus: 404 } }, 'not-found'],
    [{ status: 500 }, 'retryable'],
    [new Error('x'), 'retryable'],
    ['text', 'retryable'],
  ])('%o → %s', (error, kind) => {
    expect(classifyError(error)).toBe(kind)
  })
})
