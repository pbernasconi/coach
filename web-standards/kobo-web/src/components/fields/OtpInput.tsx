'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { sanitizeOtp } from './otpCode'

// One real <input autocomplete="one-time-code"> under N boxes. OS SMS autofill (Safari and iOS "From Messages",
// Android WebOTP) and paste target that one input, which is far more reliable than N inputs: most browsers do
// not autofill N boxes at all. The boxes only show the digits. Desktop Chromium has no SMS source: a platform limit.

// These data attributes tell password manager extensions (1Password, LastPass, Bitwarden, Dashlane) to leave the
// field alone. It is opt-in: on a sign-in screen a person may want a password manager to fill a stored TOTP code.
const PASSWORD_MANAGER_IGNORE_PROPS = {
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const

export interface OtpInputProps {
  /** The number of digits. Default 6. */
  length?: number
  /** Fires once for each new full code (typed, pasted or autofilled). */
  onComplete?: (code: string) => void
  /**
   * Fires on every change, also a Backspace below `length`. Use it when a submit button carries the code:
   * `onComplete` fires only on a full code, so a value stored there can be one the person has since deleted.
   */
  onValueChange?: (code: string) => void
  disabled?: boolean
  /** Marks the field invalid. Link the message with `ariaDescribedBy`. */
  error?: boolean
  ariaDescribedBy?: string
  /** Default "Verification code". */
  ariaLabel?: string
  autoFocus?: boolean
  /** Change it to clear the field and focus it again (after a failed check or a resend). */
  resetKey?: number | string
  /** Ask password manager extensions to leave the field alone (setup screens, not sign-in). */
  ignorePasswordManagers?: boolean
  /**
   * Opt in to Android Chrome WebOTP, which reads the code from the SMS. Off by default: on an authenticator app
   * (TOTP) screen, an SMS code would go to the wrong check and use up an attempt. Turn it on only for SMS codes.
   */
  smsAutofill?: boolean
  /** `pin` masks the digits and does not ask for one-time-code autofill. Use `PinInput`. */
  entryMode?: 'otp' | 'pin'
  className?: string
}

/**
 * A one-time code field shown as one box per digit. SMS autofill and paste work, also with "123 456" or "123-456".
 *
 *     <OtpInput onComplete={verify} resetKey={attempt} error={failed} ariaDescribedBy="code-error" smsAutofill />
 */
export function OtpInput({
  length = 6,
  onComplete,
  onValueChange,
  disabled = false,
  error = false,
  ariaDescribedBy,
  ariaLabel = 'Verification code',
  autoFocus = true,
  resetKey,
  ignorePasswordManagers = false,
  smsAutofill = false,
  entryMode = 'otp',
  className,
}: OtpInputProps) {
  const [value, setValue] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // The last full code that fired onComplete. A value, not a Boolean: autofill cannot fire the same code twice,
  // but a different full code pasted over a wrong one (select all, paste) still fires.
  const lastCompletedRef = React.useRef('')
  // The latest callbacks, so the WebOTP effect does not start again on each render.
  const onCompleteRef = React.useRef(onComplete)
  onCompleteRef.current = onComplete
  const onValueChangeRef = React.useRef(onValueChange)
  onValueChangeRef.current = onValueChange

  // There is no maxLength on the input: it would cut "123 456" before the strip and lose a digit.
  const applyValue = React.useCallback(
    (raw: string) => {
      const next = sanitizeOtp(raw, length)
      setValue(next)
      onValueChangeRef.current?.(next)
      if (next.length === length) {
        if (next !== lastCompletedRef.current) {
          lastCompletedRef.current = next
          onCompleteRef.current?.(next)
        }
      } else {
        lastCompletedRef.current = ''
      }
    },
    [length],
  )

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // A new resetKey clears the field. No resetKey: no reset (a caller that remounts with `key` starts empty).
  React.useEffect(() => {
    if (resetKey === undefined) return
    setValue('')
    onValueChangeRef.current?.('')
    lastCompletedRef.current = ''
    inputRef.current?.focus()
  }, [resetKey])

  // Android Chrome WebOTP: read the code from the SMS with no tap. Feature-detected, so it does nothing on iOS or
  // desktop. Chrome gives a code only when the SMS ends with a binding line ("@<host> #<code>"). It aborts on
  // unmount, so a late answer cannot reach an old component.
  React.useEffect(() => {
    if (!smsAutofill || typeof window === 'undefined' || !('OTPCredential' in window)) return
    const abortController = new AbortController()
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: abortController.signal } as unknown as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as { code?: string } | null)?.code
        if (code) applyValue(code)
      })
      .catch(() => {})
    return () => abortController.abort()
  }, [applyValue, smsAutofill])

  // The box that shows the caret: the first empty box, or the last box when the code is full.
  const activeIndex = Math.min(value.length, length - 1)
  const pinEntry = entryMode === 'pin'

  return (
    // The real input covers the boxes, so a click or tap anywhere on them focuses it.
    <div className={cn('relative flex justify-center gap-2', className)}>
      <input
        ref={inputRef}
        type={pinEntry ? 'password' : 'text'}
        inputMode="numeric"
        autoComplete={pinEntry ? 'off' : 'one-time-code'}
        name={pinEntry ? 'pin' : 'otp'}
        value={value}
        onChange={(event) => applyValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        aria-describedby={ariaDescribedBy}
        className="absolute inset-0 h-full w-full cursor-default text-transparent caret-transparent opacity-0 outline-none"
        {...(ignorePasswordManagers || pinEntry ? PASSWORD_MANAGER_IGNORE_PROPS : {})}
      />
      {Array.from({ length }).map((_, index) => {
        const active = focused && !disabled && index === activeIndex
        const digit = value[index]
        return (
          <div
            key={index}
            data-testid="otp-slot"
            aria-hidden="true"
            className={cn(
              'flex h-12 w-10 items-center justify-center rounded-control border bg-surface text-title2 font-semibold text-ink',
              'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard',
              active ? 'border-ring ring-2 ring-ring/30' : 'border-line-strong',
              error && 'border-danger-ink',
              disabled && 'opacity-45',
            )}
          >
            {digit === undefined ? '' : pinEntry ? '•' : digit}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A PIN field: the boxes show dots, and it does not ask for SMS or one-time-code autofill.
 *
 *     <PinInput length={4} onComplete={setPin} />
 */
export function PinInput({
  ariaLabel = 'PIN',
  ...props
}: Omit<OtpInputProps, 'entryMode' | 'ignorePasswordManagers' | 'smsAutofill'>) {
  return <OtpInput {...props} entryMode="pin" ignorePasswordManagers ariaLabel={ariaLabel} />
}
