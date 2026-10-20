import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResendCodeButton } from '../src/components/controls/ResendCodeButton'

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

const clickResend = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /resend/i }))
  })
}

describe('ResendCodeButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('counts down, then turns into a button', () => {
    render(<ResendCodeButton onResend={vi.fn()} destination="s•••@example.com" cooldownSeconds={30} />)
    expect(screen.getByText('Resend available in 30s')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument()
    tick(29_000)
    expect(screen.getByText('Resend available in 1s')).toBeInTheDocument()
    tick(1_000)
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
    expect(screen.queryByText(/resend available in/i)).not.toBeInTheDocument()
  })

  it('resends, shows and announces success, and doubles the wait up to the cap', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined)
    render(<ResendCodeButton onResend={onResend} destination="s•••@example.com" cooldownSeconds={30} />)
    tick(30_000)
    await clickResend()
    expect(onResend).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('A new code was sent to s•••@example.com')
    expect(screen.getByText('Resend available in 60s')).toBeInTheDocument()
    tick(59_000)
    expect(screen.getByText('Resend available in 1s')).toBeInTheDocument()
    tick(1_000)
    await clickResend()
    expect(screen.getByText('Resend available in 120s')).toBeInTheDocument()
    tick(120_000)
    await clickResend()
    expect(onResend).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Resend available in 120s')).toBeInTheDocument()
  })

  it('shows no success and no wait when the resend fails', async () => {
    const onResend = vi.fn().mockRejectedValue(new Error('offline'))
    render(<ResendCodeButton onResend={onResend} cooldownSeconds={30} />)
    tick(30_000)
    await clickResend()
    expect(onResend).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
    expect(screen.queryByText(/resend available in/i)).not.toBeInTheDocument()
  })

  it('takes its own words', () => {
    render(<ResendCodeButton onResend={vi.fn()} cooldownSeconds={5} countdownLabel={(s) => `Wait ${s} seconds`} />)
    expect(screen.getByText('Wait 5 seconds')).toBeInTheDocument()
  })
})
