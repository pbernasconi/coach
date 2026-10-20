import { describe, expect, it } from 'vitest'
import { countdownAnnouncement, formatCountdown, spokenDuration } from '../src/components/feedback/idleSessionFormat'

describe('idle warning countdown format', () => {
  it.each([
    [120, '2:00'],
    [65, '1:05'],
    [9, '0:09'],
    [-3, '0:00'],
    [59.9, '0:59'],
  ])('formatCountdown(%d) is %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected)
  })

  it.each([
    [120, '2 minutes'],
    [90, '1 minute 30 seconds'],
    [10, '10 seconds'],
    [0, '0 seconds'],
  ])('spokenDuration(%d) is %s', (seconds, expected) => {
    expect(spokenDuration(seconds, 'en-US')).toBe(expected)
  })

  it.each([
    [300, ''],
    [119, 'Time left: 2 minutes'],
    [61, 'Time left: 2 minutes'],
    [60, 'Time left: 1 minute'],
    [45, 'Time left: 1 minute'],
    [30, 'Time left: 30 seconds'],
    [4, 'Time left: 10 seconds'],
  ])('at %d seconds the live region says "%s"', (seconds, expected) => {
    expect(countdownAnnouncement('Time left', seconds, 'en-US')).toBe(expected)
  })
})
