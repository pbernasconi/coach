import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FloatingSelectionBar } from '../src/components/data/FloatingSelectionBar'

describe('FloatingSelectionBar', () => {
  it('renders nothing with no selection', () => {
    render(
      <FloatingSelectionBar count={0} itemNoun="file">
        <button type="button">Download</button>
      </FloatingSelectionBar>,
    )
    expect(screen.queryByRole('region', { name: 'Selection actions' })).toBeNull()
  })

  it('shows the count, the hint and the actions in a named region', () => {
    const { rerender } = render(
      <FloatingSelectionBar count={1} itemNoun="file" hint="ZIP file">
        <button type="button">Download</button>
      </FloatingSelectionBar>,
    )
    const region = screen.getByRole('region', { name: 'Selection actions' })
    expect(region).toHaveTextContent('1 file selected')
    expect(region).toHaveTextContent('ZIP file')
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()

    rerender(
      <FloatingSelectionBar count={3} itemNoun="file">
        <button type="button">Download</button>
      </FloatingSelectionBar>,
    )
    expect(screen.getByRole('region')).toHaveTextContent('3 files selected')
  })

  it('clears the selection on Escape', async () => {
    const onDismiss = vi.fn()
    render(
      <FloatingSelectionBar count={2} itemNoun="note" onDismiss={onDismiss}>
        <button type="button">Archive</button>
      </FloatingSelectionBar>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('takes its own count words', () => {
    render(
      <FloatingSelectionBar count={2} itemNoun="person" countLabel={(count) => `${count} people chosen`}>
        <button type="button">Invite</button>
      </FloatingSelectionBar>,
    )
    expect(screen.getByRole('region')).toHaveTextContent('2 people chosen')
  })
})
