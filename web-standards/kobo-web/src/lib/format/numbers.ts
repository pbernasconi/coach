import { DASH, MINUS } from './money'

/**
 * Number formats for dense data screens. One module, so the same value never prints as "$1.2B" on one screen
 * and "$1.23B" on the next. Every function prints "—" for null, undefined or a value that is not finite.
 */

type Maybe = number | null | undefined

function isPrintable(value: Maybe): value is number {
  return value != null && Number.isFinite(value)
}

function signed(text: string, negative: boolean): string {
  return negative ? `${MINUS}${text}` : text
}

function grouped(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** "1,234" or "1,234.5". */
export function formatNumber(value: Maybe, decimals = 0): string {
  if (!isPrintable(value)) return DASH
  return signed(grouped(Math.abs(value), decimals), value < 0)
}

/** "12.3%". `value` is already a percent (12.3), not a ratio (0.123). */
export function formatPercent(value: Maybe, decimals = 1): string {
  if (!isPrintable(value)) return DASH
  return signed(`${grouped(Math.abs(value), decimals)}%`, value < 0)
}

/** "1.45×": a multiple. */
export function formatMultiple(value: Maybe, decimals = 2): string {
  if (!isPrintable(value)) return DASH
  return signed(`${Math.abs(value).toFixed(decimals)}×`, value < 0)
}

/** "+0.4" or "−0.4": a change, where the sign is the point. Zero has no sign. */
export function formatDelta(value: Maybe, decimals = 1, suffix = ''): string {
  if (!isPrintable(value)) return DASH
  const text = `${grouped(Math.abs(value), decimals)}${suffix}`
  if (value === 0) return text
  return value > 0 ? `+${text}` : `${MINUS}${text}`
}

/** The unit of the source value: dollars, thousands of dollars, or millions of dollars. */
export type MoneyScale = 'units' | 'thousands' | 'millions'

const SCALE_FACTOR: Record<MoneyScale, number> = { units: 1, thousands: 1e3, millions: 1e6 }

/**
 * Short money for tables and tiles: "$1.2B", "$478.0M", "$820K", "$950".
 * Use `scale` when the source column is in thousands or millions.
 */
export function formatCompactMoney(value: Maybe, options: { scale?: MoneyScale; decimals?: number } = {}): string {
  if (!isPrintable(value)) return DASH
  const { scale = 'units', decimals = 1 } = options
  const dollars = Math.abs(value * SCALE_FACTOR[scale])
  let text: string
  if (dollars >= 1e12) text = `$${(dollars / 1e12).toFixed(decimals)}T`
  else if (dollars >= 1e9) text = `$${(dollars / 1e9).toFixed(decimals)}B`
  else if (dollars >= 1e6) text = `$${(dollars / 1e6).toFixed(decimals)}M`
  else if (dollars >= 1e3) text = `$${Math.round(dollars / 1e3)}K`
  else text = `$${Math.round(dollars)}`
  return signed(text, value < 0)
}

/** "512 B", "13 KB", "4.2 MB", "1.1 GB". */
export function formatBytes(value: Maybe): string {
  if (!isPrintable(value) || value < 0) return DASH
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`
  return `${value} B`
}
