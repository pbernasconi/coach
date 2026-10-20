'use client'

import { useCallback, useEffect, useState } from 'react'

export type StoredValueArea = 'local' | 'session'

export interface StoredValueOptions {
  /** `local` (the default) keeps the value across visits; `session` keeps it for this tab only. */
  area?: StoredValueArea
}

/** The storage area, or null when the browser blocks it (private mode, a sandboxed frame, no window). */
const storageFor = (area: StoredValueArea): Storage | null => {
  try {
    if (typeof window === 'undefined') return null
    return area === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

const read = (area: StoredValueArea, key: string): string | null => {
  try {
    return storageFor(area)?.getItem(key) ?? null
  } catch {
    return null
  }
}

const write = (area: StoredValueArea, key: string, value: string) => {
  try {
    storageFor(area)?.setItem(key, value)
  } catch {
    // A full or blocked storage keeps the value in React state only.
  }
}

const remove = (area: StoredValueArea, key: string) => {
  try {
    storageFor(area)?.removeItem(key)
  } catch {
    // Nothing to remove when storage is blocked.
  }
}

/**
 * A JSON value in browser storage, held in React state. The caller owns the key. A stored value that is not valid
 * JSON or fails `isValid` is removed, and the state keeps `initialValue`. The first render always uses
 * `initialValue` (the server has no storage); `hydrated` turns true after the stored value is read.
 *
 * Pass a stable `initialValue` and `isValid` (module constants), or the value reads again on every render.
 *
 *     const [pinned, setPinned, { removeValue, hydrated }] = useStoredValue(`notes.pinned.${userId}`, NO_IDS, isIdList)
 */
export function useStoredValue<T>(
  key: string,
  initialValue: T,
  isValid: (value: unknown) => value is T,
  { area = 'local' }: StoredValueOptions = {},
) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // A new key starts from the initial value: the old key's value never shows under the new key.
    setHydrated(false)
    setStoredValue(initialValue)
    const item = read(area, key)
    if (item !== null) {
      try {
        const parsed: unknown = JSON.parse(item)
        if (isValid(parsed)) setStoredValue(parsed)
        else remove(area, key)
      } catch {
        remove(area, key)
      }
    }
    setHydrated(true)
  }, [area, initialValue, isValid, key])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value
        write(area, key, JSON.stringify(next))
        return next
      })
    },
    [area, key],
  )

  const removeValue = useCallback(() => {
    setStoredValue(initialValue)
    remove(area, key)
  }, [area, initialValue, key])

  return [storedValue, setValue, { removeValue, hydrated }] as const
}
