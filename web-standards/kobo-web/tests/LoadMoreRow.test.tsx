import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoadMoreRow } from '../src/components/data/LoadMoreRow'

describe('LoadMoreRow', () => {
  it('shows the count and loads the next page', async () => {
    const onLoadMore = vi.fn()
    render(<LoadMoreRow hasMore isLoading={false} onLoadMore={onLoadMore} count={{ loaded: 50, total: 212 }} />)
    expect(screen.getByText('Showing 50 of 212')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('spins in place and blocks clicks while the page loads', () => {
    render(<LoadMoreRow hasMore isLoading onLoadMore={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Load more' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('says a failure out loud and retries with onRetry', async () => {
    const onLoadMore = vi.fn()
    const onRetry = vi.fn()
    render(<LoadMoreRow hasMore isLoading={false} error={new Error('offline')} onLoadMore={onLoadMore} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load more')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('retries with onLoadMore when there is no onRetry', async () => {
    const onLoadMore = vi.fn()
    render(<LoadMoreRow hasMore isLoading={false} error="boom" onLoadMore={onLoadMore} />)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('shows the ceiling notice and no button when the server stopped the list', () => {
    render(<LoadMoreRow hasMore={false} bounded isLoading={false} onLoadMore={vi.fn()} count={{ loaded: 500, total: 2000 }} />)
    expect(screen.getByText('Narrow your filters to see older results.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing at the end of a list with no count', () => {
    const { container } = render(<LoadMoreRow hasMore={false} isLoading={false} onLoadMore={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('takes its own words', () => {
    render(<LoadMoreRow hasMore isLoading={false} onLoadMore={vi.fn()} summary="12 trips" copy={{ loadMore: 'See more trips' }} />)
    expect(screen.getByText('12 trips')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See more trips' })).toBeInTheDocument()
  })
})
