import './stubResizeObserver'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOOLTIP_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipIconTrigger,
  TooltipProvider,
  TooltipTrigger,
} from '../src/components/overlays/Tooltip'

function Sample({ variant }: { variant?: 'standard' | 'dark' | 'card' }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Due date</TooltipTrigger>
        <TooltipContent variant={variant}>Shown in your time zone</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

describe('Tooltip', () => {
  it('uses the shared 200ms hover delay', () => {
    expect(DEFAULT_TOOLTIP_DELAY_MS).toBe(200)
  })

  it('opens on hover and names itself with role tooltip', async () => {
    const user = userEvent.setup()
    render(<Sample />)
    await user.hover(screen.getByRole('button', { name: 'Due date' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Shown in your time zone')
  })

  it('opens on keyboard focus and closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Sample variant="standard" />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Due date' })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Shown in your time zone')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('draws no caret on the standard variant, even when asked', async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Due date</TooltipTrigger>
          <TooltipContent variant="standard" showArrow>
            Shown in your time zone
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    await screen.findByRole('tooltip')
    const surface = document.querySelector('[data-variant="standard"]')
    expect(surface).not.toBeNull()
    expect(surface?.querySelector('svg')).toBeNull()
  })

  it('draws a caret on the card variant when asked', async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Due date</TooltipTrigger>
          <TooltipContent variant="card" showArrow>
            Shown in your time zone
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    await screen.findByRole('tooltip')
    expect(document.querySelector('[data-variant="card"] svg')).not.toBeNull()
  })

  it('gives a passive icon trigger a button type and a name', () => {
    render(<TooltipIconTrigger aria-label="Synced">✓</TooltipIconTrigger>)
    expect(screen.getByRole('button', { name: 'Synced' })).toHaveAttribute('type', 'button')
  })
})
