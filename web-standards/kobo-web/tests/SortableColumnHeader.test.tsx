import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SortableColumnHeader } from '../src/components/data/SortableColumnHeader'
import type { SortDirection } from '../src/components/data/sortModel'

function Harness({ clearable = false, defaultDirection }: { clearable?: boolean; defaultDirection?: SortDirection }) {
  const [sort, setSort] = useState<{ field: 'name' | null; direction: SortDirection }>({ field: null, direction: 'asc' })
  return (
    <SortableColumnHeader
      field="name"
      label="Name"
      activeField={sort.field}
      direction={sort.direction}
      defaultDirection={defaultDirection}
      onSortChange={(field, direction) => setSort({ field, direction })}
      onClearSort={clearable ? () => setSort({ field: null, direction: 'asc' }) : undefined}
    />
  )
}

describe('SortableColumnHeader', () => {
  it('names the next action and flips the direction on the second click', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Sort by Name, ascending' })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)
    expect(screen.getByRole('button', { name: 'Sort by Name, descending' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Sort by Name, descending' }))
    expect(screen.getByRole('button', { name: 'Sort by Name, ascending' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('applies the default direction on the first click', async () => {
    const onSortChange = vi.fn()
    render(
      <SortableColumnHeader
        field="date"
        label="Date"
        activeField={null}
        direction="asc"
        defaultDirection="desc"
        onSortChange={onSortChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Date, descending' }))
    expect(onSortChange).toHaveBeenCalledWith('date', 'desc')
  })

  it('clears the sort on the third click when it can', async () => {
    const user = userEvent.setup()
    render(<Harness clearable />)
    await user.click(screen.getByRole('button', { name: 'Sort by Name, ascending' }))
    await user.click(screen.getByRole('button', { name: 'Sort by Name, descending' }))
    await user.click(screen.getByRole('button', { name: 'Clear sorting by Name' }))
    expect(screen.getByRole('button', { name: 'Sort by Name, ascending' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('works from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Sort by Name, descending' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('takes its own words', () => {
    render(
      <SortableColumnHeader
        field="size"
        label="Size"
        activeField={null}
        direction="asc"
        directionLabels={{ asc: 'Small to large', desc: 'Large to small' }}
        onSortChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Sort by Size, small to large' })).toBeInTheDocument()
  })
})
