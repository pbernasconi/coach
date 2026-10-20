import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMountEffect } from '../src/hooks/useMountEffect'

describe('useMountEffect', () => {
  it('runs once on mount and cleans up on unmount, even when the effect changes', () => {
    const cleanup = vi.fn()
    const first = vi.fn(() => cleanup)
    const second = vi.fn()
    const { rerender, unmount } = renderHook(({ effect }) => useMountEffect(effect), {
      initialProps: { effect: first as () => void | (() => void) },
    })
    rerender({ effect: second })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
