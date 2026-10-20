import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdleSessionWarning } from '../src/components/feedback/IdleSessionWarning'

const MIN = 60_000
const TIMEOUT = 10 * MIN
const WARN = 2 * MIN

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

describe('IdleSessionWarning', () => {
  beforeEach(() => {
    // shouldAdvanceTime lets userEvent's own waits finish; the test still moves the session clock by hand.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('renders nothing while the end is far', async () => {
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={vi.fn()} onTimeout={vi.fn()} />)
    // A margin of 1 s: shouldAdvanceTime also moves the clock by the real time that the test takes.
    await advance(TIMEOUT - WARN - 1_000)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('opens an alert dialog with a countdown and focus on "Stay signed in"', async () => {
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={vi.fn()} onTimeout={vi.fn()} />)
    await advance(TIMEOUT - WARN)
    const dialog = screen.getByRole('alertdialog', { name: 'Are you still there?' })
    expect(dialog).toHaveAccessibleDescription(/sign you out soon/)
    expect(dialog).toHaveTextContent(/Time left\s+2:00/)
    expect(screen.getByRole('button', { name: 'Stay signed in' })).toHaveFocus()
    await advance(30_000)
    expect(dialog).toHaveTextContent(/Time left\s+1:30/)
    expect(screen.getByText('Time left: 2 minutes')).toBeInTheDocument()
  })

  it('"Stay signed in" extends and closes the dialog', async () => {
    const onExtend = vi.fn()
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={onExtend} onTimeout={vi.fn()} />)
    await advance(TIMEOUT - WARN)
    await user().click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(onExtend).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('Escape counts as "Stay signed in"', async () => {
    const onExtend = vi.fn()
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={onExtend} onTimeout={vi.fn()} />)
    await advance(TIMEOUT - WARN)
    await user().keyboard('{Escape}')
    expect(onExtend).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows an error and stays open when the extension fails', async () => {
    const onExtend = vi.fn(() => Promise.reject(new Error('offline')))
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={onExtend} onTimeout={vi.fn()} />)
    await advance(TIMEOUT - WARN)
    await user().click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('We could not keep you signed in. Try again.')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('times out at the end', async () => {
    const onTimeout = vi.fn()
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={vi.fn()} onTimeout={onTimeout} />)
    await advance(TIMEOUT)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('"Sign out" calls onSignOut and stops the clock', async () => {
    const onSignOut = vi.fn()
    const onTimeout = vi.fn()
    render(
      <IdleSessionWarning
        timeoutMs={TIMEOUT}
        warnBeforeMs={WARN}
        onExtend={vi.fn()}
        onTimeout={onTimeout}
        onSignOut={onSignOut}
        labels={{ signOut: 'Log out' }}
      />,
    )
    await advance(TIMEOUT - WARN)
    await user().click(screen.getByRole('button', { name: 'Log out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
    await advance(TIMEOUT)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('extends with no dialog after the person used the page', async () => {
    const onExtend = vi.fn()
    render(<IdleSessionWarning timeoutMs={TIMEOUT} warnBeforeMs={WARN} onExtend={onExtend} onTimeout={vi.fn()} />)
    await advance(MIN)
    await user().keyboard('a')
    await advance(TIMEOUT - WARN - MIN)
    expect(onExtend).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('closes when the session was extended somewhere else', async () => {
    let extended: () => void = () => {}
    const unsubscribe = vi.fn()
    const { unmount } = render(
      <IdleSessionWarning
        timeoutMs={TIMEOUT}
        warnBeforeMs={WARN}
        onExtend={vi.fn()}
        onTimeout={vi.fn()}
        subscribeToExtensions={(onExtended) => {
          extended = onExtended
          return unsubscribe
        }}
      />,
    )
    await advance(TIMEOUT - WARN)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    act(() => extended())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
