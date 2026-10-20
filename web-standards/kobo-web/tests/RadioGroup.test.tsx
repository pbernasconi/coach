import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RadioGroup, RadioGroupItem } from '../src/components/controls/RadioGroup'

function Sizes({ onValueChange }: { onValueChange: (value: string) => void }) {
  return (
    <RadioGroup aria-label="Size" defaultValue="s" onValueChange={onValueChange}>
      <RadioGroupItem value="s" aria-label="Small" />
      <RadioGroupItem value="m" aria-label="Medium" />
      <RadioGroupItem value="l" aria-label="Large" disabled />
    </RadioGroup>
  )
}

describe('RadioGroup', () => {
  it('selects an item on click', async () => {
    const onValueChange = vi.fn()
    render(<Sizes onValueChange={onValueChange} />)
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Medium' }))
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked()
    expect(onValueChange).toHaveBeenCalledWith('m')
  })

  it('moves with the arrow keys and skips a disabled item', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Sizes onValueChange={onValueChange} />)
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Small' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Small' })).toHaveFocus()
  })
})
