import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FlowShell } from '../src/components/layout/FlowShell'
import { Dialog, DialogContent, DialogTitle } from '../src/components/overlays/Dialog'

describe('FlowShell', () => {
  it('closes from the close button', async () => {
    const onClose = vi.fn()
    render(
      <FlowShell onClose={onClose} closeLabel="Close new trip">
        <p>Flow content</p>
      </FlowShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close new trip' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the close guard says no', async () => {
    const onClose = vi.fn()
    const beforeClose = vi.fn(async () => false)
    render(
      <FlowShell onClose={onClose} beforeClose={beforeClose}>
        <p>Flow content</p>
      </FlowShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(beforeClose).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape through the same guard', async () => {
    const onClose = vi.fn()
    const beforeClose = vi.fn(() => true)
    render(
      <FlowShell onClose={onClose} beforeClose={beforeClose}>
        <p>Flow content</p>
      </FlowShell>,
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(beforeClose).toHaveBeenCalledTimes(1)
  })

  it('lets an open dialog take Escape first', async () => {
    const onClose = vi.fn()
    render(
      <FlowShell onClose={onClose}>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Rename trip</DialogTitle>
          </DialogContent>
        </Dialog>
      </FlowShell>,
    )
    expect(screen.getByRole('dialog', { name: 'Rename trip' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows Back only with onBack, and calls it', async () => {
    const onBack = vi.fn()
    const { rerender } = render(
      <FlowShell onClose={() => {}}>
        <p>x</p>
      </FlowShell>,
    )
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    rerender(
      <FlowShell onClose={() => {}} onBack={onBack} backLabel="Back to dates">
        <p>x</p>
      </FlowShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Back to dates' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows the title, the brand, the notice and the pinned footer', () => {
    render(
      <FlowShell
        onClose={() => {}}
        title="New trip"
        brand={<a href="/">Atlas</a>}
        notice={<p role="status">Offline</p>}
        footer={<footer>Actions</footer>}
        leftRail={<aside>Steps</aside>}
      >
        <p>Long content</p>
      </FlowShell>,
    )
    expect(screen.getByText('New trip')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Atlas' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('status')).toHaveTextContent('Offline')
    expect(screen.getByRole('main')).toHaveTextContent('Long content')
    expect(screen.getByRole('complementary')).toHaveTextContent('Steps')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Actions')
  })
})
