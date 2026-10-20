'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export interface ResendCodeButtonProps {
  /** Sends a new code. A rejection keeps the button usable and shows no success. Show the error yourself. */
  onResend: () => Promise<void>
  /** Seconds before the first resend. It doubles after each resend, up to `maxCooldownSeconds`. Default 30. */
  cooldownSeconds?: number
  /** The longest wait between resends. Default 120. */
  maxCooldownSeconds?: number
  /** Where the code goes, already masked ("s•••@example.com"). It goes in the success message. */
  destination?: string
  /** The button words. */
  resendLabel?: string
  /** The button words while the code is on its way. */
  sendingLabel?: string
  /** The words while the person must wait. */
  countdownLabel?: (seconds: number) => string
  /** The success words, seen and announced. */
  sentLabel?: (destination: string | undefined) => string
  className?: string
}

/**
 * "Didn't get the code?" for a code step: a countdown that turns into a button when a resend is allowed. The wait
 * doubles after each resend, so people do not send many codes in a row.
 *
 *     <ResendCodeButton onResend={sendCode} destination="s•••@example.com" />
 */
export function ResendCodeButton({
  onResend,
  cooldownSeconds = 30,
  maxCooldownSeconds = 120,
  destination,
  resendLabel = "Didn't get the code? Resend",
  sendingLabel = 'Resending…',
  countdownLabel = (seconds) => `Resend available in ${seconds}s`,
  sentLabel = (to) => (to ? `A new code was sent to ${to}` : 'A new code was sent'),
  className,
}: ResendCodeButtonProps) {
  const [nextCooldown, setNextCooldown] = React.useState(cooldownSeconds)
  const [remaining, setRemaining] = React.useState(cooldownSeconds)
  const [sending, setSending] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState('')

  React.useEffect(() => {
    const timer = setInterval(() => setRemaining((seconds) => (seconds > 0 ? seconds - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [])

  const canResend = remaining <= 0 && !sending

  const handleResend = async () => {
    if (!canResend) return
    setSending(true)
    try {
      await onResend()
      // Only after the code went out: a longer wait and the success words.
      const next = Math.min(nextCooldown * 2, maxCooldownSeconds)
      setNextCooldown(next)
      setRemaining(next)
      setConfirmation(sentLabel(destination))
    } catch {
      // The parent shows the failure. Catch it here, so there is no unhandled rejection.
      setConfirmation('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-1.5 text-center', className)}>
      {canResend ? (
        <Button variant="plain" className="min-h-10 py-2" disabled={sending} onClick={() => void handleResend()}>
          {sending ? sendingLabel : resendLabel}
        </Button>
      ) : (
        <p className="min-h-10 py-2 text-body text-ink-muted tabular-nums">{countdownLabel(remaining)}</p>
      )}
      {/* Always mounted, so a screen reader hears the text change. A new node that already has text is not always
          read. It is hidden until there is something to say. */}
      <p role="status" aria-live="polite" aria-atomic="true" className={cn('text-body text-success-ink', !confirmation && 'sr-only')}>
        {confirmation}
      </p>
    </div>
  )
}
