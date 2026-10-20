import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateToIso,
  evaluateDateText,
  formatMediumDate,
  isoToDate,
  isoToMaskText,
  isoWeekday,
  normalizeDateText,
  parseIsoDate,
  quickDateChips,
  type DateBounds,
} from '../src/components/fields/dateText'
import vectors from './vectors/date-picker-field.json'

interface VectorBounds {
  minDate?: string
  maxDate?: string
  disabledWeekdays?: number[]
}

function toBounds({ minDate, maxDate, disabledWeekdays }: VectorBounds): DateBounds {
  return {
    min: minDate,
    max: maxDate,
    isUnavailable: disabledWeekdays ? (iso) => disabledWeekdays.includes(isoWeekday(iso)) : undefined,
  }
}

const messages = {
  invalid: vectors.defaultErrors.invalid,
  beforeMin: vectors.defaultErrors.min,
  afterMax: vectors.defaultErrors.max,
  unavailable: vectors.defaultErrors.unavailable,
}

describe('normalizeDateText (date-picker-field.json)', () => {
  it.each(vectors.normalize)('$raw', ({ raw, text }) => {
    expect(normalizeDateText(raw)).toBe(text)
  })
})

describe('evaluateDateText (date-picker-field.json)', () => {
  it.each(vectors.evaluate)('$text with $bounds', (vector) => {
    const result = evaluateDateText(vector.text, toBounds(vector.bounds), messages)
    expect(result.status).toBe(vector.status)
    expect(result.message).toBe(vector.message)
    if ('date' in vector) expect(result.date).toBe(vector.date)
  })
})

describe('isoToMaskText (date-picker-field.json)', () => {
  it.each(vectors.format)('$date', ({ date, text }) => {
    expect(isoToMaskText(date)).toBe(text)
  })
})

describe('quickDateChips (date-picker-field.json)', () => {
  it.each(vectors.quickChips)('today $today, min $minDate', (vector) => {
    const chips = quickDateChips(vector.today, toBounds(vector))
    expect(chips).toEqual(vector.chips.map((chip) => ({ label: chip.label, value: chip.date })))
  })
})

describe('ISO day helpers', () => {
  it.each([
    ['2024-02-29', true],
    ['2023-02-29', false],
    ['2026-13-01', false],
    ['2026-7-1', false],
    ['', false],
  ])('parseIsoDate(%j) is valid: %s', (iso, valid) => {
    expect(parseIsoDate(iso) !== null).toBe(valid)
  })

  it('round-trips a day through a local-midnight Date', () => {
    const date = isoToDate('2026-03-08')
    expect(date?.getHours()).toBe(0)
    expect(date && dateToIso(date)).toBe('2026-03-08')
    expect(isoToDate('nope')).toBeUndefined()
  })

  it('adds days across a month and a year', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('names weekdays the ISO way and formats a medium date', () => {
    expect(isoWeekday('2026-07-25')).toBe(6)
    expect(isoWeekday('2026-07-26')).toBe(7)
    expect(formatMediumDate('2026-07-15')).toBe('Jul 15, 2026')
    expect(formatMediumDate('')).toBe('')
  })
})
