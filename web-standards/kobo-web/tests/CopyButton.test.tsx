import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COPIED_RESET_MS, CopyButton } from '../src/components/controls/CopyButton'

afterEach(() => vi.useRealTimers())

describe('CopyButton', () => {
  it('copies the value and says so in a live region', async () => {
    const user = userEvent.setup()
    render(<CopyButton value="INV-20431" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await navigator.clipboard.readText()).toBe('INV-20431')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('goes back to "Copy" after the reset time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CopyButton value="INV-20431" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(COPIED_RESET_MS))
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says "Could not copy" when the clipboard fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))
    render(<CopyButton value="INV-20431" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy')
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('clears its timer when it unmounts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(<CopyButton value="INV-20431" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('takes custom words', async () => {
    const user = userEvent.setup()
    render(<CopyButton value="x" copyLabel="Copy link" copiedLabel="Link copied" />)
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(screen.getByRole('status')).toHaveTextContent('Link copied')
  })
})
