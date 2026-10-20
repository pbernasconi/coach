import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, CheckboxField } from '../src/components/controls/Checkbox'

describe('Checkbox', () => {
  it('toggles and reports the new state', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Pin" onCheckedChange={onCheckedChange} />)
    const box = screen.getByRole('checkbox', { name: 'Pin' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(box).toBeChecked()
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('does not toggle when disabled', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Pin" disabled onCheckedChange={onCheckedChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pin' }))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('shows a mixed state', () => {
    render(<Checkbox aria-label="Some notes" checked="indeterminate" />)
    expect(screen.getByRole('checkbox', { name: 'Some notes' })).toHaveAttribute('aria-checked', 'mixed')
  })
})

describe('CheckboxField', () => {
  it('names the box with its label and toggles from a click on the text', async () => {
    render(<CheckboxField label="Email me a summary" description="Every Monday" />)
    const box = screen.getByRole('checkbox', { name: /Email me a summary/ })
    await userEvent.click(screen.getByText('Email me a summary'))
    expect(box).toBeChecked()
    expect(screen.getByText('Every Monday')).toBeInTheDocument()
  })

  it('keeps a given id', () => {
    render(<CheckboxField id="pin" label="Pin" />)
    expect(screen.getByRole('checkbox', { name: 'Pin' })).toHaveAttribute('id', 'pin')
  })
})
