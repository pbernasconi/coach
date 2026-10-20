import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '../src/components/controls/Switch'

describe('Switch', () => {
  it('is a switch that flips on click and on Space', async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch aria-label="Sync" onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole('switch', { name: 'Sync' })
    await user.click(control)
    expect(control).toBeChecked()
    await user.keyboard(' ')
    expect(control).not.toBeChecked()
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]])
  })

  it('does not flip when disabled', async () => {
    const onCheckedChange = vi.fn()
    render(<Switch aria-label="Sync" disabled onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole('switch', { name: 'Sync' })
    expect(control).toBeDisabled()
    await userEvent.click(control)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
