import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToggleRow } from '../src/components/controls/ToggleRow'

const base = { label: 'Daily summary', checked: false, onCheckedChange: vi.fn() }

describe('ToggleRow', () => {
  it('names the switch with its label and describes it with the description', () => {
    render(<ToggleRow {...base} description="An email at 8 AM" />)
    const control = screen.getByRole('switch', { name: 'Daily summary' })
    expect(control).toHaveAccessibleDescription('An email at 8 AM')
  })

  it('renders no description when none is given', () => {
    render(<ToggleRow {...base} />)
    expect(screen.getByRole('switch', { name: 'Daily summary' })).not.toHaveAttribute('aria-describedby')
  })

  it('reflects the checked state', () => {
    const { rerender } = render(<ToggleRow {...base} checked={false} />)
    expect(screen.getByRole('switch')).not.toBeChecked()
    rerender(<ToggleRow {...base} checked />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('reports a flip from the switch and from the label', async () => {
    const onCheckedChange = vi.fn()
    render(<ToggleRow {...base} onCheckedChange={onCheckedChange} />)
    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByText('Daily summary'))
    expect(onCheckedChange.mock.calls).toEqual([[true], [true]])
  })

  it('does not flip when disabled', async () => {
    const onCheckedChange = vi.fn()
    render(<ToggleRow {...base} onCheckedChange={onCheckedChange} disabled />)
    expect(screen.getByRole('switch')).toBeDisabled()
    await userEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('puts the help button outside the label, so it never flips the switch', async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<ToggleRow {...base} onCheckedChange={onCheckedChange} help="Only on days with new notes." />)
    const help = screen.getByRole('button', { name: 'More info' })
    expect(help.closest('label')).toBeNull()
    await user.hover(help)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Only on days with new notes.')
    await user.click(help)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
