'use client'

import * as React from 'react'
import { Button } from '../controls/Button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../overlays/AlertDialog'
import { useMountEffect } from '../../hooks/useMountEffect'
import { createIdleSessionController, secondsLeft, type IdleSessionClock } from './idleSessionController'
import { countdownAnnouncement, formatCountdown } from './idleSessionFormat'

export interface IdleSessionLabels {
  title: string
  description: string
  stay: string
  signOut: string
  /** The words before the countdown ("Time left 1:30"). */
  countdown: string
  /** Shown when "Stay signed in" fails. */
  extendError: string
}

const DEFAULT_LABELS: IdleSessionLabels = {
  title: 'Are you still there?',
  description: 'You have not used the page for a while. To keep your data safe, we will sign you out soon.',
  stay: 'Stay signed in',
  signOut: 'Sign out',
  countdown: 'Time left',
  extendError: 'We could not keep you signed in. Try again.',
}

/** The kinds of input that show the person is there. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

export interface IdleSessionWarningProps {
  /** How long the session lasts after the last extension. Read once, on mount: change `key` to start again. */
  timeoutMs: number
  /** How long before the end the warning opens. Read once, on mount. */
  warnBeforeMs: number
  /** Extends the session. A rejection keeps the warning open with an error. */
  onExtend: () => void | Promise<void>
  /** Ends the session (sign the person out). Called once, at the end. */
  onTimeout: () => void
  /** The "Sign out" button. Without it, the button calls `onTimeout`. Either way the clock stops. */
  onSignOut?: () => void
  /**
   * When the person last used the page. By default the warning listens for pointer, key, wheel and touch input
   * itself. Input after the last extension extends without a dialog.
   */
  lastActivityAtMs?: () => number
  /**
   * Hears extensions from somewhere else (another tab, a server answer). Call `onExtended` when one happens; it
   * starts a new period and closes the warning. Return a function that stops listening.
   */
  subscribeToExtensions?: (onExtended: () => void) => () => void
  labels?: Partial<IdleSessionLabels>
  /** The locale of the spoken countdown. */
  locale?: string
  /** Time and timers, for tests. */
  clock?: IdleSessionClock
}

/**
 * The warning before an idle sign-out (WCAG 2.2.1 Timing Adjustable). It renders nothing until the end is near.
 * Then an alert dialog takes focus on "Stay signed in", shows a countdown, and announces the time left at a few
 * milestones, not every second. Escape counts as "Stay signed in": the person is there. A tab that comes back
 * from the background checks the clock again.
 *
 *     <IdleSessionWarning timeoutMs={30 * 60_000} warnBeforeMs={2 * 60_000}
 *       onExtend={() => api.refreshSession()} onTimeout={signOut} />
 */
export function IdleSessionWarning({
  timeoutMs,
  warnBeforeMs,
  onExtend,
  onTimeout,
  onSignOut,
  lastActivityAtMs,
  subscribeToExtensions,
  labels: labelOverrides,
  locale,
  clock,
}: IdleSessionWarningProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  // The controller lives for the whole mount and calls the newest props through this ref.
  const latest = React.useRef({ onExtend, onTimeout, lastActivityAtMs, subscribeToExtensions })
  React.useEffect(() => {
    latest.current = { onExtend, onTimeout, lastActivityAtMs, subscribeToExtensions }
  })
  const lastInput = React.useRef(Number.NEGATIVE_INFINITY)

  const [controller] = React.useState(() =>
    createIdleSessionController({
      timeoutMs,
      warnBeforeMs,
      extend: () => latest.current.onExtend(),
      timeout: () => latest.current.onTimeout(),
      lastActivityAtMs: () => latest.current.lastActivityAtMs?.() ?? lastInput.current,
      clock,
    }),
  )

  useMountEffect(() => {
    const now = clock?.now ?? Date.now
    const onInput = () => {
      lastInput.current = now()
    }
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onInput, { capture: true, passive: true })
    controller.start()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') controller.sync()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const unsubscribe = latest.current.subscribeToExtensions?.(() => controller.reset())
    return () => {
      controller.stop()
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onInput, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
      unsubscribe?.()
    }
  })

  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const stayRef = React.useRef<HTMLButtonElement>(null)
  if (snapshot.phase !== 'warning') return null

  const seconds = secondsLeft(snapshot.deadlineMs, snapshot.nowMs)
  const stay = () => void controller.stay()

  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) stay()
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          stayRef.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>{labels.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-body text-ink-muted">
          {labels.countdown}{' '}
          {/* The visible countdown is silent; the live region below speaks only at milestones. */}
          <span aria-hidden="true" className="font-semibold text-ink tabular-nums">
            {formatCountdown(seconds)}
          </span>
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {countdownAnnouncement(labels.countdown, seconds, locale)}
        </p>
        {snapshot.extendError ? (
          <p role="alert" className="text-body text-danger-ink">
            {labels.extendError}
          </p>
        ) : null}
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              // Stop the clock first, so the timeout does not fire a second sign-out later.
              controller.stop()
              ;(onSignOut ?? onTimeout)()
            }}
          >
            {labels.signOut}
          </Button>
          <Button ref={stayRef} loading={snapshot.extending} onClick={stay}>
            {labels.stay}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
