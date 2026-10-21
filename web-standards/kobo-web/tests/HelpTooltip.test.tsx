import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpTooltip } from '../src/components/overlays/HelpTooltip'

describe('HelpTooltip', () => {
  it('gives the trigger a custom name', () => {
    render(<HelpTooltip label="What is a tag?">Tags group notes across folders.</HelpTooltip>)
    expect(screen.getByRole('button', { name: 'What is a tag?' })).toBeInTheDocument()
  })

  it('names the trigger "More info" by default', () => {
    render(<HelpTooltip>Some help</HelpTooltip>)
    expect(screen.getByRole('button', { name: 'More info' })).toBeInTheDocument()
  })

  it('keeps the trigger out of the tab order', async () => {
    const user = userEvent.setup()
    render(<HelpTooltip label="What is a tag?">Tags group notes across folders.</HelpTooltip>)
    const trigger = screen.getByRole('button', { name: 'What is a tag?' })
    expect(trigger).toHaveAttribute('tabindex', '-1')
    await user.tab()
    expect(trigger).not.toHaveFocus()
  })

  it('shows its help text on hover', async () => {
    const user = userEvent.setup()
    render(<HelpTooltip label="What is a tag?">Tags group notes across folders.</HelpTooltip>)
    await user.hover(screen.getByRole('button', { name: 'What is a tag?' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Tags group notes across folders.')
  })

  it('shows a custom icon in place of the "?"', () => {
    render(<HelpTooltip icon={<svg data-testid="info-icon" aria-hidden="true" />}>Some help</HelpTooltip>)
    expect(screen.getByRole('button', { name: 'More info' })).toContainElement(screen.getByTestId('info-icon'))
  })
})
