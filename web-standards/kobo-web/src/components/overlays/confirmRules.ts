/** A reason the person must or may type before an action. */
export interface ConfirmReason {
  label: string
  description?: string
  placeholder?: string
  /** Block the action until there is a reason. */
  required?: boolean
  minLength?: number
  maxLength?: number
}

/** A word the person must type before an action that cannot be undone. */
export interface ConfirmTypedWord {
  label: string
  expected: string
  caseSensitive?: boolean
}

/**
 * Why the confirm button is blocked, or null when it is not.
 * An empty optional reason passes. An empty required reason is "missing". A short reason is "short".
 */
export function confirmBlocker(
  options: { reason?: ConfirmReason; typedWord?: ConfirmTypedWord },
  values: { reason: string; typedWord: string },
): 'reason-missing' | 'reason-short' | 'word-mismatch' | null {
  const { reason, typedWord } = options
  if (reason) {
    const text = values.reason.trim()
    if (reason.required && text.length === 0) return 'reason-missing'
    if (text.length > 0 && text.length < (reason.minLength ?? 0)) return 'reason-short'
  }
  if (typedWord) {
    const typed = values.typedWord.trim()
    const match = typedWord.caseSensitive
      ? typed === typedWord.expected
      : typed.toLowerCase() === typedWord.expected.toLowerCase()
    if (!match) return 'word-mismatch'
  }
  return null
}
