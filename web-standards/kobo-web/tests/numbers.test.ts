import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCompactMoney,
  formatDelta,
  formatMultiple,
  formatNumber,
  formatPercent,
} from '../src/lib/format/numbers'

describe('missing values', () => {
  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])('prints a dash for %s', (value) => {
    expect(formatNumber(value)).toBe('—')
    expect(formatPercent(value)).toBe('—')
    expect(formatMultiple(value)).toBe('—')
    expect(formatDelta(value)).toBe('—')
    expect(formatCompactMoney(value)).toBe('—')
    expect(formatBytes(value)).toBe('—')
  })
})

describe('formatCompactMoney', () => {
  it.each([
    [2_400_000_000, {}, '$2.4B'],
    [478_000_000, {}, '$478.0M'],
    [820_400, {}, '$820K'],
    [950, {}, '$950'],
    [-1_500_000, {}, '−$1.5M'],
    [1234, { scale: 'millions' as const }, '$1.2B'],
    [45_600, { scale: 'thousands' as const }, '$45.6M'],
    [2_400_000_000, { decimals: 2 }, '$2.40B'],
  ])('%d %o → %s', (value, options, expected) => {
    expect(formatCompactMoney(value, options)).toBe(expected)
  })
})

describe('formats', () => {
  it('groups and signs numbers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(-1234.5, 1)).toBe('−1,234.5')
  })
  it('prints percents, multiples and deltas', () => {
    expect(formatPercent(12.345)).toBe('12.3%')
    expect(formatMultiple(1.456)).toBe('1.46×')
    expect(formatDelta(0.4)).toBe('+0.4')
    expect(formatDelta(-0.4, 1, ' pts')).toBe('−0.4 pts')
    expect(formatDelta(0)).toBe('0.0')
  })
  it('prints byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(13_000)).toBe('13 KB')
    expect(formatBytes(4.2 * 1024 ** 2)).toBe('4.2 MB')
  })
})
