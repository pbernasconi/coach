import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RadioCards } from '../src/components/controls/RadioCards'

const options = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' },
]

describe('RadioCards', () => {
  it('renders every option as a named radio in a named group', () => {
    render(<RadioCards aria-label="Repeat" options={options} value="daily" onValueChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'Repeat' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Every day' })).toBeChecked()
  })

  it('selects an option from a click anywhere on the card text', async () => {
    const onValueChange = vi.fn()
    render(<RadioCards options={options} value="daily" onValueChange={onValueChange} />)
    await userEvent.click(screen.getByText('Every week'))
    expect(onValueChange).toHaveBeenCalledWith('weekly')
  })

  it('does not select a disabled option', async () => {
    const onValueChange = vi.fn()
    render(
      <RadioCards
        options={[...options, { id: 'never', label: 'Never', disabled: true }]}
        value="daily"
        onValueChange={onValueChange}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Never' })).toBeDisabled()
    await userEvent.click(screen.getByText('Never'))
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
