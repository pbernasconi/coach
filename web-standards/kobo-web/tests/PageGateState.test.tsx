import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageGateState } from '../src/patterns/PageGateState'
import { pageGateStatus } from '../src/patterns/pageGate'

describe('pageGateStatus', () => {
  it.each([
    ['a slow session is never a denial', { data: undefined }, false, 'loading'],
    ['a null session is still loading', { data: null }, true, 'loading'],
    ['a failed session load is an error', { data: undefined, isError: true }, false, 'error'],
    ['a known session without the permission is denied', { data: {} }, false, 'denied'],
    ['a known session with the permission is allowed', { data: {} }, true, 'allowed'],
  ] as const)('%s', (_, session, allowed, expected) => {
    expect(pageGateStatus(session, allowed)).toBe(expected)
  })
})

describe('PageGateState', () => {
  it('says the page loads, one time', () => {
    render(<PageGateState status="loading" title="Shared notes" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading Shared notes')
  })

  it('names the page that is not available', () => {
    render(<PageGateState status="denied" title="Shared notes" />)
    expect(screen.getByRole('heading', { name: 'Shared notes is not available' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('retries a failed session load', async () => {
    const onRetry = vi.fn()
    render(<PageGateState status="error" error={new Error('down')} onRetry={onRetry} title="Templates" />)
    expect(screen.getByRole('heading', { name: 'We could not load Templates' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
