import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStoredValue } from '../src/hooks/useStoredValue'

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')
const NO_NUMBERS: number[] = []

describe('useStoredValue', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('hydrates a value that passes its runtime check', async () => {
    localStorage.setItem('recent.a', JSON.stringify([1, 2]))
    const { result } = renderHook(() => useStoredValue('recent.a', NO_NUMBERS, isNumberList))
    await waitFor(() => expect(result.current[2].hydrated).toBe(true))
    expect(result.current[0]).toEqual([1, 2])
  })

  it('drops valid JSON with the wrong shape', async () => {
    localStorage.setItem('recent.a', JSON.stringify({ ids: [1, 2] }))
    const { result } = renderHook(() => useStoredValue('recent.a', NO_NUMBERS, isNumberList))
    await waitFor(() => expect(result.current[2].hydrated).toBe(true))
    expect(result.current[0]).toEqual([])
    expect(localStorage.getItem('recent.a')).toBeNull()
  })

  it('drops malformed JSON without throwing into React', async () => {
    localStorage.setItem('recent.a', '{broken')
    const { result } = renderHook(() => useStoredValue('recent.a', NO_NUMBERS, isNumberList))
    await waitFor(() => expect(result.current[2].hydrated).toBe(true))
    expect(result.current[0]).toEqual([])
    expect(localStorage.getItem('recent.a')).toBeNull()
  })

  it('reads the new key when the key changes', async () => {
    localStorage.setItem('recent.person-a', JSON.stringify([1, 2]))
    localStorage.setItem('recent.person-b', JSON.stringify([3]))
    const { result, rerender } = renderHook(({ key }) => useStoredValue(key, NO_NUMBERS, isNumberList), {
      initialProps: { key: 'recent.person-a' },
    })
    await waitFor(() => expect(result.current[0]).toEqual([1, 2]))
    rerender({ key: 'recent.person-b' })
    await waitFor(() => expect(result.current[0]).toEqual([3]))
    expect(result.current[2].hydrated).toBe(true)
  })

  it('writes updater values, and removeValue clears storage and state', async () => {
    const { result } = renderHook(() => useStoredValue('recent.a', NO_NUMBERS, isNumberList))
    await waitFor(() => expect(result.current[2].hydrated).toBe(true))

    act(() => result.current[1]((previous) => [...previous, 7]))
    expect(result.current[0]).toEqual([7])
    expect(JSON.parse(localStorage.getItem('recent.a') ?? '[]')).toEqual([7])

    act(() => result.current[2].removeValue())
    expect(result.current[0]).toEqual([])
    expect(localStorage.getItem('recent.a')).toBeNull()
  })

  it('uses sessionStorage when the area is session', async () => {
    const { result } = renderHook(() => useStoredValue('draft', NO_NUMBERS, isNumberList, { area: 'session' }))
    await waitFor(() => expect(result.current[2].hydrated).toBe(true))
    act(() => result.current[1]([4]))
    expect(sessionStorage.getItem('draft')).toBe('[4]')
    expect(localStorage.getItem('draft')).toBeNull()
  })
})
