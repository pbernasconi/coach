import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COUNTDOWN_TICK_MS,
  createIdleSessionController,
  secondsLeft,
  type IdleSessionClock,
} from '../src/components/feedback/idleSessionController'

const MIN = 60_000
const TIMEOUT = 30 * MIN
const WARN = 2 * MIN

const clock: IdleSessionClock = {
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

let lastInput = Number.NEGATIVE_INFINITY
const setUp = (extend: () => void | Promise<void> = () => {}) => {
  const timeout = vi.fn()
  const extendSpy = vi.fn(extend)
  const controller = createIdleSessionController({
    timeoutMs: TIMEOUT,
    warnBeforeMs: WARN,
    extend: extendSpy,
    timeout,
    lastActivityAtMs: () => lastInput,
    clock,
  })
  return { controller, timeout, extend: extendSpy }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('secondsLeft', () => {
  it.each([
    [10_000, 8_500, 2],
    [10_000, 12_000, 0],
    [10_000, 10_000, 0],
  ])('deadline %d at %d is %d', (deadline, now, expected) => {
    expect(secondsLeft(deadline, now)).toBe(expected)
  })
})

describe('createIdleSessionController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    lastInput = Number.NEGATIVE_INFINITY
  })
  afterEach(() => vi.useRealTimers())

  it('stays quiet until the warning is due, then counts down and times out once', async () => {
    const { controller, timeout } = setUp()
    controller.start()
    expect(controller.getSnapshot().phase).toBe('watching')

    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN - 1)
    expect(controller.getSnapshot().phase).toBe('watching')
    await vi.advanceTimersByTimeAsync(1)
    const open = controller.getSnapshot()
    expect(open.phase).toBe('warning')
    expect(secondsLeft(open.deadlineMs, open.nowMs)).toBe(120)

    await vi.advanceTimersByTimeAsync(30 * COUNTDOWN_TICK_MS)
    const ticking = controller.getSnapshot()
    expect(secondsLeft(ticking.deadlineMs, ticking.nowMs)).toBe(90)

    await vi.advanceTimersByTimeAsync(90_000)
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().phase).toBe('timed-out')
    await vi.advanceTimersByTimeAsync(TIMEOUT)
    expect(timeout).toHaveBeenCalledTimes(1)
  })

  it('extends with no dialog when the person used the page after the last extension', async () => {
    const { controller, extend } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(10 * MIN)
    lastInput = Date.now()
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN - 10 * MIN)
    expect(extend).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().phase).toBe('watching')
    expect(controller.getSnapshot().deadlineMs).toBe(Date.now() + TIMEOUT)
  })

  it('opens the dialog when a silent extension fails', async () => {
    const { controller, extend } = setUp(() => Promise.reject(new Error('offline')))
    controller.start()
    lastInput = Date.now() + 1
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN)
    expect(extend).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().phase).toBe('warning')
    // A silent failure shows no error: the person did not press anything.
    expect(controller.getSnapshot().extendError).toBeNull()
  })

  it('"Stay signed in" extends and closes the warning; the old end time no longer fires', async () => {
    const { controller, extend, timeout } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN)
    expect(controller.getSnapshot().phase).toBe('warning')
    await controller.stay()
    expect(extend).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().phase).toBe('watching')
    await vi.advanceTimersByTimeAsync(WARN)
    expect(timeout).not.toHaveBeenCalled()
  })

  it('keeps the warning open with the error when "Stay signed in" fails', async () => {
    const failure = new Error('network')
    const { controller } = setUp(() => Promise.reject(failure))
    controller.start()
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN)
    await controller.stay()
    expect(controller.getSnapshot().phase).toBe('warning')
    expect(controller.getSnapshot().extendError).toBe(failure)
  })

  it('does not time out while "Stay signed in" is in flight, and keeps the session when it succeeds', async () => {
    let answer: () => void = () => {}
    const { controller, timeout } = setUp(() => new Promise<void>((resolve) => (answer = resolve)))
    controller.start()
    await vi.advanceTimersByTimeAsync(TIMEOUT - 1_000)
    const pressed = controller.stay()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(timeout).not.toHaveBeenCalled()
    answer()
    await pressed
    expect(controller.getSnapshot().phase).toBe('watching')
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN - 1)
    expect(timeout).not.toHaveBeenCalled()
  })

  it('times out at once when the "Stay signed in" in flight at the end fails', async () => {
    let fail: (error: unknown) => void = () => {}
    const { controller, timeout } = setUp(() => new Promise<void>((_, reject) => (fail = reject)))
    controller.start()
    await vi.advanceTimersByTimeAsync(TIMEOUT - 1_000)
    const pressed = controller.stay()
    await vi.advanceTimersByTimeAsync(5_000)
    fail(new Error('network'))
    await pressed
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().phase).toBe('timed-out')
  })

  it('reset (an extension somewhere else) closes the warning and ignores a stale extension', async () => {
    let fail: (error: unknown) => void = () => {}
    const { controller, timeout } = setUp(() => new Promise<void>((_, reject) => (fail = reject)))
    controller.start()
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN)
    const pressed = controller.stay()
    controller.reset()
    expect(controller.getSnapshot().phase).toBe('watching')
    fail(new Error('late'))
    await pressed
    await flush()
    expect(controller.getSnapshot().phase).toBe('watching')
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN - 1)
    expect(timeout).not.toHaveBeenCalled()
  })

  it('sync times out at once when the timers ran late past the end', () => {
    const { controller, timeout } = setUp()
    controller.start()
    // The machine slept: the clock moves but no timer ran.
    vi.setSystemTime(Date.now() + TIMEOUT + MIN)
    controller.sync()
    expect(timeout).toHaveBeenCalledTimes(1)
  })

  it('stops every timer on stop, and a new start begins a new period', async () => {
    const { controller, timeout } = setUp()
    controller.start()
    controller.stop()
    await vi.advanceTimersByTimeAsync(2 * TIMEOUT)
    expect(timeout).not.toHaveBeenCalled()
    expect(controller.getSnapshot().phase).toBe('stopped')
    controller.start()
    expect(controller.getSnapshot().deadlineMs).toBe(Date.now() + TIMEOUT)
  })

  it('tells subscribers about changes', async () => {
    const { controller } = setUp()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    controller.start()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    await vi.advanceTimersByTimeAsync(TIMEOUT - WARN)
    expect(listener).not.toHaveBeenCalled()
  })
})
