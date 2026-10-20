import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewSection } from '../src/components/data/ReviewSection'

const rows = [
  { label: 'From', value: 'Lisbon' },
  { label: 'To', value: 'Porto' },
]

describe('ReviewSection', () => {
  it('shows the title and each label with its value', () => {
    render(<ReviewSection title="Trip details" rows={rows} />)
    const section = screen.getByRole('region', { name: 'Trip details' })
    expect(within(section).getByRole('heading', { name: 'Trip details' })).toBeInTheDocument()
    expect(within(section).getAllByRole('term').map((term) => term.textContent)).toEqual(['From', 'To'])
    expect(within(section).getAllByRole('definition').map((value) => value.textContent)).toEqual(['Lisbon', 'Porto'])
    expect(within(section).getByText('Porto')).toBeInTheDocument()
    expect(within(section).queryByRole('button')).toBeNull()
  })

  it('has an Edit button named for the section', async () => {
    const onEdit = vi.fn()
    render(<ReviewSection title="Trip details" rows={rows} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Trip details' }))
    expect(onEdit).toHaveBeenCalledOnce()
  })
})
