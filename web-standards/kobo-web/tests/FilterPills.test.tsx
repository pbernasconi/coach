import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterPills } from '../src/components/navigation/FilterPills'
import { formatPillCount } from '../src/components/navigation/pillCount'

const filters = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open', count: 12 },
  { id: 'done', label: 'Done', count: 8 },
  { id: 'shared', label: 'Shared' },
]

describe('formatPillCount', () => {
  it.each([
    [200, false, '200+'],
    [200, true, '200'],
    [7, undefined, '7'],
  ])('%i with exact=%s reads %s', (count, exact, expected) => {
    expect(formatPillCount(count, exact)).toBe(expected)
  })
})

describe('FilterPills', () => {
  it('renders every filter and presses only the active one', () => {
    render(<FilterPills filters={filters} activeFilter="open" onFilterChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Open/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Done/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Shared' })).toBeInTheDocument()
  })

  it('calls onFilterChange with the id', async () => {
    const onFilterChange = vi.fn()
    render(<FilterPills filters={filters} activeFilter="all" onFilterChange={onFilterChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Done/ }))
    expect(onFilterChange).toHaveBeenCalledWith('done')
  })

  it('shows counts, with a floor as N+', () => {
    render(
      <FilterPills
        filters={[...filters, { id: 'old', label: 'Old', count: 200, countIsExact: false }]}
        activeFilter="all"
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('200+')).toBeInTheDocument()
  })

  it('shows Add filter only with onAddFilter, and calls it', async () => {
    const onAddFilter = vi.fn()
    const { rerender } = render(<FilterPills filters={filters} activeFilter="all" onFilterChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Add filter' })).not.toBeInTheDocument()
    rerender(<FilterPills filters={filters} activeFilter="all" onFilterChange={vi.fn()} onAddFilter={onAddFilter} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    expect(onAddFilter).toHaveBeenCalledOnce()
  })

  it('removes the active filter from its own button, without picking it', async () => {
    const onRemoveFilter = vi.fn()
    const onFilterChange = vi.fn()
    render(
      <FilterPills filters={filters} activeFilter="open" onFilterChange={onFilterChange} onRemoveFilter={onRemoveFilter} />,
    )
    expect(screen.queryByRole('button', { name: 'Remove All' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Open' }))
    expect(onRemoveFilter).toHaveBeenCalledWith('open')
    expect(onFilterChange).not.toHaveBeenCalled()
  })
})
