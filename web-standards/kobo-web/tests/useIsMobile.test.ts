import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile } from '../src/hooks/useIsMobile'

type Listener = () => void

/** A matchMedia stub whose `matches` the test can flip. */
const stubViewport = (initial: boolean) => {
  const listeners = new Set<Listener>()
  const state = { matches: initial, query: '' }
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      state.query = query
      return {
        get matches() {
          return state.matches
        },
        media: query,
        addEventListener: (_: string, listener: Listener) => listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
      }
    }),
  )
  return {
    state,
    set(matches: boolean) {
      state.matches = matches
      listeners.forEach((listener) => listener())
    },
  }
}

describe('useIsMobile', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('follows the viewport', () => {
    const viewport = stubViewport(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
    expect(viewport.state.query).toBe('(max-width: 767px)')
    act(() => viewport.set(false))
    expect(result.current).toBe(false)
  })

  it('takes a custom breakpoint', () => {
    const viewport = stubViewport(false)
    renderHook(() => useIsMobile(1024))
    expect(viewport.state.query).toBe('(max-width: 1023px)')
  })

  it('is false when the browser has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})
