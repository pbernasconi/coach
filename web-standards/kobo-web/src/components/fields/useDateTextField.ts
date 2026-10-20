'use client'

import * as React from 'react'
import {
  DEFAULT_DATE_MESSAGES,
  evaluateDateText,
  isoToMaskText,
  maskDateDigits,
  normalizeDateText,
  type DateBounds,
  type DateMessages,
} from './dateText'

interface DateTextFieldOptions {
  value: string
  onChange: (value: string) => void
  clearable: boolean
  onErrorChange?: (error: string | null) => void
  min?: string
  max?: string
  messages?: Partial<DateMessages>
}

const digitsOf = (iso: string) => isoToMaskText(iso).replace(/\D/g, '')

/**
 * The state of `DateTextInput`: the typed digits, the error, whether the error shows, and the calendar.
 * A half-typed date blocks the parent (onErrorChange gets a message) but shows no red error until the person
 * has typed eight digits, leaves the field, or presses Enter.
 */
export function useDateTextField({ value, onChange, clearable, onErrorChange, min, max, messages }: DateTextFieldOptions) {
  // Keyed on the strings, so an inline `messages` object does not reset the field on every render.
  const { invalid, beforeMin, afterMax, unavailable } = { ...DEFAULT_DATE_MESSAGES, ...messages }
  const merged = React.useMemo(
    () => ({ invalid, beforeMin, afterMax, unavailable }),
    [invalid, beforeMin, afterMax, unavailable],
  )
  const bounds = React.useMemo<DateBounds>(() => ({ min, max }), [min, max])
  const validate = React.useCallback(
    (digits: string) => {
      const result = evaluateDateText(maskDateDigits(digits), bounds, merged)
      if (result.status === 'VALID') return { iso: result.date ?? null, error: null }
      return { iso: null, error: result.message ?? merged.invalid }
    },
    [bounds, merged],
  )

  const initialError = value ? validate(digitsOf(value)).error : null
  const [digits, setDigits] = React.useState(() => digitsOf(value))
  const [error, setError] = React.useState<string | null>(initialError)
  const [errorVisible, setErrorVisible] = React.useState(initialError !== null)
  const [open, setOpen] = React.useState(false)

  // A new value or new bounds from the parent replace the text and check it again.
  React.useEffect(() => {
    const next = digitsOf(value)
    const nextError = value ? validate(next).error : null
    setDigits(next)
    setError(nextError)
    setErrorVisible(nextError !== null)
  }, [value, validate])

  const onErrorChangeRef = React.useRef(onErrorChange)
  onErrorChangeRef.current = onErrorChange
  React.useEffect(() => {
    onErrorChangeRef.current?.(error)
  }, [error])

  const changeDigits = (next: string) => {
    setDigits(next)
    if (clearable && next === '') {
      setError(null)
      setErrorVisible(false)
      onChange('')
      return
    }
    const result = validate(next)
    setError(result.error)
    // A full date that is wrong shows now. A half-typed one stays calm while the person moves through MM/DD/YYYY.
    setErrorVisible(next.length === 8 && result.error !== null)
    if (result.iso) onChange(result.iso)
  }

  const commit = (iso: string) => {
    setDigits(digitsOf(iso))
    setError(null)
    setErrorVisible(false)
    onChange(iso)
    setOpen(false)
  }

  const restore = () => {
    setDigits(digitsOf(value))
    setError(null)
    setErrorVisible(false)
  }

  return {
    digits,
    error,
    showError: errorVisible && error !== null,
    open,
    setOpen,
    changeDigits,
    commit,
    /** A shortcut day commits only when it passes the same checks as typed text. */
    commitShortcut: (iso: string) => {
      const result = validate(digitsOf(iso))
      if (result.iso) commit(result.iso)
    },
    onBlur: () => {
      if (error) setErrorVisible(true)
      else if (value) setDigits(digitsOf(value))
    },
    onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
      const text = normalizeDateText(event.clipboardData.getData('text'))
      if (!text) return
      event.preventDefault()
      changeDigits(text.replace(/\D/g, ''))
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' && event.altKey) {
        event.preventDefault()
        setOpen(true)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        restore()
        setOpen(false)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (error) setErrorVisible(true)
        else if (value) setDigits(digitsOf(value))
        setOpen(false)
      }
    },
  }
}
