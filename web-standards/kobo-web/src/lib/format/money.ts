/**
 * Money from integer minor units (cents). The texts and spoken labels are the vectors in
 * tests/vectors/money-format.json, so Kobo (SwiftUI) can test against the same file.
 *
 * Rules: money is integer cents in state. Invalid input is `null`, never 0. Never format money with `/100`,
 * `toFixed` or `toLocaleString` in a component: call these functions.
 */

/** The minus sign of every money display (U+2212, not a hyphen). */
export const MINUS = '−'
/** The text of a value that is missing or not a finite number. */
export const DASH = '—'
export const MONEY_UNAVAILABLE_LABEL = 'Amount unavailable'
export const MONEY_HIDDEN_LABEL = 'Amount hidden'

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$' }

function symbolFor(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `
}

/** Integer cents, or null when the value is not finite. A fraction rounds half away from zero (8.5 → 9). */
function printableCents(cents: number): number | null {
  if (!Number.isFinite(cents)) return null
  const rounded = Math.sign(cents) * Math.round(Math.abs(cents))
  return rounded === 0 ? 0 : rounded
}

interface MoneyParts {
  negative: boolean
  symbol: string
  whole: string
  fraction: string
}

function moneyParts(cents: number, currency: string): MoneyParts | null {
  const printable = printableCents(cents)
  if (printable === null) return null
  const abs = Math.abs(printable)
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return {
    negative: printable < 0,
    symbol: symbolFor(currency),
    whole,
    fraction: String(abs % 100).padStart(2, '0'),
  }
}

/** "$1,299.00", "−$45.99", "€1.00". en-US grouping on every device. A non-finite value prints "—". */
export function formatMoney(cents: number, currency = 'USD'): string {
  const parts = moneyParts(cents, currency)
  if (parts === null) return DASH
  return `${parts.negative ? MINUS : ''}${parts.symbol}${parts.whole}.${parts.fraction}`
}

/** "+$8.52" or "−$8.52": for a change, where the sign is the point. Zero has no sign. */
export function formatSignedMoney(cents: number, currency = 'USD'): string {
  const printable = printableCents(cents)
  if (printable === null) return DASH
  const sign = printable > 0 ? '+' : ''
  return `${sign}${formatMoney(printable, currency)}`
}

/** What a screen reader says: "negative 45 dollars and 99 cents". Other currencies speak the printed text. */
export function formatMoneyLabel(cents: number, currency = 'USD'): string {
  const parts = moneyParts(cents, currency)
  if (parts === null) return MONEY_UNAVAILABLE_LABEL
  const sign = parts.negative ? 'negative ' : ''
  if (currency !== 'USD') return `${sign}${parts.symbol}${parts.whole}.${parts.fraction}`
  return `${sign}${parts.whole} dollars and ${parts.fraction} cents`
}

/** "$••••": a hidden amount keeps only its currency symbol, so it never reads as $0.00. */
export function formatMoneyHidden(currency = 'USD'): string {
  return `${symbolFor(currency)}••••`
}
