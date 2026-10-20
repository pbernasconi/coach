/**
 * The clock of the idle warning, with no React and no DOM (WCAG 2.2.1 Timing Adjustable).
 *
 * The session ends `timeoutMs` after the last extension. `warnBeforeMs` before the end:
 * 1. If the person used the page after the last extension (typing in a long form sends no request), extend at once,
 *    with no dialog: the person is there.
 * 2. Otherwise open the warning with a countdown. "Stay signed in" extends; `reset()` (an extension somewhere else,
 *    for example another tab) closes it.
 * 3. At the end, if nothing extended the session, call `timeout`. An extension in flight at the end decides
 *    instead: success keeps the session, failure times out at once.
 *
 * Time and timers come in through `clock`, so tests drive it with fake timers.
 */

/** The countdown refresh while the warning is open. */
export const COUNTDOWN_TICK_MS = 1_000

export interface IdleSessionClock {
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
}

/** The browser clock. */
export const systemClock: IdleSessionClock = {
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface IdleSessionOptions {
  /** How long the session lasts after the last extension. */
  timeoutMs: number
  /** How long before the end the warning opens. */
  warnBeforeMs: number
  /** Extends the session (for example a request to the server). A rejection keeps the warning open with the error. */
  extend: () => void | Promise<void>
  /** Ends the session. Called once. */
  timeout: () => void
  /** When the person last used the page. Input after the last extension extends without a dialog. */
  lastActivityAtMs?: () => number
  clock?: IdleSessionClock
}

/** Whole seconds left, rounded up so the countdown shows 0:00 only at the end. */
export const secondsLeft = (deadlineMs: number, nowMs: number): number => Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000))

export type IdlePhase = 'watching' | 'warning' | 'timed-out' | 'stopped'

export interface IdleSessionSnapshot {
  phase: IdlePhase
  deadlineMs: number
  nowMs: number
  extending: boolean
  /** The last "Stay signed in" failed with this error. Cleared on the next try. */
  extendError: unknown
}

export interface IdleSessionController {
  start: () => void
  stop: () => void
  /** The session was extended somewhere else: start a new period and close any warning. */
  reset: () => void
  /** Check the clock again now (timers can be late after a sleep or in a background tab). */
  sync: () => void
  /** "Stay signed in". */
  stay: () => Promise<void>
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => IdleSessionSnapshot
}

export const createIdleSessionController = (options: IdleSessionOptions): IdleSessionController => {
  const clock = options.clock ?? systemClock
  const listeners = new Set<() => void>()
  let snapshot: IdleSessionSnapshot = {
    phase: 'stopped',
    deadlineMs: clock.now() + options.timeoutMs,
    nowMs: clock.now(),
    extending: false,
    extendError: null,
  }
  let periodStartMs = clock.now()
  let checkTimer: unknown = null
  let tickTimer: unknown = null
  // A start or stop makes the answers of older extensions stale.
  let generation = 0

  const set = (patch: Partial<IdleSessionSnapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }
  const live = () => snapshot.phase === 'watching' || snapshot.phase === 'warning'

  const clearCheck = () => {
    if (checkTimer !== null) clock.clearTimer(checkTimer)
    checkTimer = null
  }
  const clearTick = () => {
    if (tickTimer !== null) clock.clearTimer(tickTimer)
    tickTimer = null
  }
  const at = (whenMs: number, fn: () => void) => {
    clearCheck()
    checkTimer = clock.setTimer(() => {
      checkTimer = null
      fn()
    }, Math.max(0, whenMs - clock.now()))
  }

  const tick = () => {
    tickTimer = null
    if (snapshot.phase !== 'warning') return
    set({ nowMs: clock.now() })
    tickTimer = clock.setTimer(tick, COUNTDOWN_TICK_MS)
  }

  const expire = () => {
    if (!live() || snapshot.extending) return
    clearCheck()
    clearTick()
    set({ phase: 'timed-out', nowMs: clock.now() })
    options.timeout()
  }

  const openWarning = () => {
    set({ phase: 'warning', nowMs: clock.now() })
    at(snapshot.deadlineMs, expire)
    if (tickTimer === null) tickTimer = clock.setTimer(tick, COUNTDOWN_TICK_MS)
  }

  const newPeriod = () => {
    periodStartMs = clock.now()
    clearTick()
    set({ phase: 'watching', deadlineMs: periodStartMs + options.timeoutMs, nowMs: periodStartMs, extendError: null })
    schedule()
  }

  const extendNow = async (silent: boolean) => {
    const gen = generation
    set({ extending: true, extendError: null })
    try {
      await options.extend()
      if (gen !== generation || !live()) return
      set({ extending: false })
      newPeriod()
    } catch (error) {
      if (gen !== generation || !live()) return
      // A failed silent extension falls back to the dialog, so the person can still act.
      set({ extending: false, extendError: silent ? null : error })
      if (clock.now() >= snapshot.deadlineMs) expire()
      else openWarning()
    }
  }

  const enterWarningWindow = () => {
    const active = options.lastActivityAtMs?.() ?? Number.NEGATIVE_INFINITY
    if (snapshot.phase !== 'warning' && active > periodStartMs) void extendNow(true)
    else openWarning()
  }

  // Put the next timer in place for where the clock is now.
  const schedule = () => {
    if (!live() || snapshot.extending) return
    const now = clock.now()
    if (now >= snapshot.deadlineMs) return expire()
    if (now >= snapshot.deadlineMs - options.warnBeforeMs) return enterWarningWindow()
    at(snapshot.deadlineMs - options.warnBeforeMs, enterWarningWindow)
  }

  return {
    start: () => {
      generation++
      set({ phase: 'watching', extending: false })
      newPeriod()
    },
    stop: () => {
      generation++
      clearCheck()
      clearTick()
      set({ phase: 'stopped', extending: false })
    },
    reset: () => {
      if (!live()) return
      // An extension still in flight is now stale: its answer must not reopen the warning.
      generation++
      set({ extending: false })
      newPeriod()
    },
    sync: () => {
      if (live()) set({ nowMs: clock.now() })
      schedule()
    },
    stay: async () => {
      if (snapshot.phase !== 'warning' || snapshot.extending) return
      await extendNow(false)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
  }
}
