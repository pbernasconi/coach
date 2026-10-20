import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Calendar } from '../src/components/fields/Calendar'
import { DatePicker } from '../src/components/fields/DatePicker'

const dayButton = (container: HTMLElement, day: string) =>
  within(container).getByRole('button', { name: (_name, element) => element.textContent?.trim() === day })

describe('DatePicker', () => {
  it('shows the placeholder when empty and a medium date when set', () => {
    const { rerender } = render(<DatePicker value="" onChange={vi.fn()} placeholder="Pick a day" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick a day')
    rerender(<DatePicker value="2026-07-15" onChange={vi.fn()} placeholder="Pick a day" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Jul 15, 2026')
  })

  it('takes its name from aria-label', () => {
    render(<DatePicker value="" onChange={vi.fn()} aria-label="Trip start" />)
    expect(screen.getByRole('combobox', { name: 'Trip start' })).toBeInTheDocument()
  })

  it('emits the ISO day and closes when a day is picked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-10" onChange={onChange} />)
    await user.click(screen.getByRole('combobox'))
    const grid = await screen.findByRole('grid')
    await user.click(dayButton(grid, '15'))
    expect(onChange).toHaveBeenCalledWith('2026-07-15')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('disables days before min and keeps later days', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2026-07-10" onChange={vi.fn()} min="2026-07-10" />)
    await user.click(screen.getByRole('combobox'))
    const grid = await screen.findByRole('grid')
    expect(dayButton(grid, '5')).toBeDisabled()
    expect(dayButton(grid, '20')).toBeEnabled()
  })

  it('clears the day from the Clear button, and shows no Clear when empty', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<DatePicker value="2026-07-15" onChange={onChange} clearable />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith('')
    rerender(<DatePicker value="" onChange={onChange} clearable />)
    await user.click(screen.getByRole('combobox'))
    await screen.findByRole('grid')
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })
})

describe('Calendar', () => {
  it('moves the focus between days with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Calendar mode="single" defaultMonth={new Date(2026, 6, 1)} selected={new Date(2026, 6, 10)} />)
    await user.click(screen.getByRole('button', { name: /July 10th, 2026/ }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /July 11th, 2026/ })).toHaveFocus()
  })

  it('has named month buttons', () => {
    render(<Calendar mode="single" defaultMonth={new Date(2026, 6, 1)} />)
    expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument()
  })
})
