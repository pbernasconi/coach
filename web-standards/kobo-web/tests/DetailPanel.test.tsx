import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DetailPanel, detailPanelWidths } from '../src/components/data/DetailPanel'

describe('DetailPanel', () => {
  it('shows a dialog named by its title when open', () => {
    render(
      <DetailPanel open onClose={vi.fn()} title="Trip to Lisbon">
        <p>Three nights</p>
      </DetailPanel>,
    )
    expect(screen.getByRole('dialog', { name: 'Trip to Lisbon' })).toBeInTheDocument()
    expect(screen.getByText('Three nights')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <DetailPanel open={false} onClose={vi.fn()} title="Trip to Lisbon">
        <p>Three nights</p>
      </DetailPanel>,
    )
    expect(screen.queryByText('Three nights')).toBeNull()
  })

  it('has a hidden title when there is no visible one', () => {
    render(
      <DetailPanel open onClose={vi.fn()}>
        <p>Body</p>
      </DetailPanel>,
    )
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument()
  })

  it('closes with the close button and with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <DetailPanel open onClose={onClose} title="Recipe">
        <p>Body</p>
      </DetailPanel>,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('pairs each width with the phone clamp and the sm override', () => {
    for (const [size, px] of [
      ['sm', 360],
      ['md', 400],
      ['lg', 480],
    ] as const) {
      expect(detailPanelWidths[size]).toBe(`w-[${px}px] max-w-full sm:max-w-[${px}px]`)
    }
  })
})
