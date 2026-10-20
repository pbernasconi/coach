
// BigInt() calls, not 10n literals, so apps that target ES2017 still type-check this source.
const TEN = BigInt(10)
const ZERO = BigInt(0)
/**
 * The text logic of `CurrencyInput`, with integer math only. The cases are tests/vectors/currency-input.json,
 * money-parse.json and amount-locale.json.
 *
 * Money is integer minor units (cents). Text that has no number is `null`, never 0.
 */

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function minorUnits(whole: string, fraction: string, digits: number): bigint {
  const paddedFraction = fraction.slice(0, digits).padEnd(digits, '0')
  return BigInt(whole || '0') * TEN ** BigInt(digits) + BigInt(paddedFraction || '0')
}

export interface ParsedCurrencyText {
  /** The minor units, or null when the text has no digit. */
  cents: number | null
  /** The text the field shows: only digits, one point, at most `digits` decimals, grouped with commas. */
  sanitizedText: string
}

/** Reads loosely typed text: drops every character that is not a digit or the first point, and cuts extra decimals. */
export function parseCurrencyText(text: string, digits = 2): ParsedCurrencyText {
  const kept = text.replace(/[^0-9.]/g, '')
  const point = kept.indexOf('.')
  const hasPoint = point >= 0 && digits > 0
  const rawWhole = point >= 0 ? kept.slice(0, point) : kept
  const fraction = hasPoint ? kept.slice(point + 1).replace(/\./g, '').slice(0, digits) : ''
  const whole = rawWhole.replace(/^0+(?=\d)/, '')
  const sanitizedText = groupThousands(whole) + (hasPoint ? `.${fraction}` : '')
  if (!whole && !fraction) return { cents: null, sanitizedText }
  return { cents: Number(minorUnits(whole, fraction, digits)), sanitizedText }
}

/** "1,299.00" from 129900; "" from null. A negative value has a leading hyphen. */
export function formatCentsText(cents: number | null, digits = 2): string {
  if (cents === null || !Number.isFinite(cents)) return ''
  const plain = centsToDecimalString(Math.abs(cents), digits, true)
  const [whole = '0', fraction] = plain.split('.')
  const sign = cents < 0 ? '-' : ''
  return `${sign}${groupThousands(whole)}${fraction === undefined ? '' : `.${fraction}`}`
}

/**
 * The plain decimal string of minor units, for the field value: 500 → "5" ("5.00" when `fixed`), 1250 → "12.5".
 */
export function centsToDecimalString(cents: number, digits = 2, fixed = false): string {
  const negative = cents < 0
  const abs = BigInt(Math.round(Math.abs(cents)))
  const scale = TEN ** BigInt(digits)
  const whole = (abs / scale).toString()
  let fraction = digits > 0 ? (abs % scale).toString().padStart(digits, '0') : ''
  if (!fixed) fraction = fraction.replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Minor units from a plain decimal string ("12.5" → 1250). Extra decimals are cut. No digit gives null. */
export function decimalStringToCents(value: string, digits = 2): number | null {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(value.trim())
  if (!match) return null
  const whole = match[1] ?? ''
  const fraction = match[2] ?? ''
  if (!whole && !fraction) return null
  return Number(minorUnits(whole, fraction, digits))
}

/** Pads a plain decimal string to `digits` decimals ("123" → "123.00"). Text that is not a number stays as it is. */
export function padDecimalString(value: string, digits = 2): string {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(value)
  if (!match || (!match[1] && !match[2])) return value
  const whole = match[1] || '0'
  if (digits === 0) return whole
  return `${whole}.${(match[2] ?? '').slice(0, digits).padEnd(digits, '0')}`
}

export type MoneyParseFailure = 'EMPTY' | 'INVALID' | 'TOO_MANY_DECIMALS' | 'NEGATIVE_NOT_ALLOWED' | 'TOO_LARGE'
export type MoneyParseResult = { ok: true; cents: number } | { ok: false; reason: MoneyParseFailure }

const STRICT_AMOUNT = /^(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?$/

/**
 * The strict parser for validation: "$1,234.56" → 123456. It rejects text that a person could read two ways
 * ("1,23", "1 234", "1e3") and tells why.
 */
export function parseMoney(input: string, options: { allowNegative?: boolean; digits?: number } = {}): MoneyParseResult {
  const digits = options.digits ?? 2
  let rest = input.trim()
  if (!rest) return { ok: false, reason: 'EMPTY' }
  let negative = false
  const takeSign = () => {
    if (rest.startsWith('-') || rest.startsWith('−')) {
      if (negative) return false
      negative = true
      rest = rest.slice(1)
    }
    return true
  }
  takeSign()
  if (rest.startsWith('$')) rest = rest.slice(1)
  if (!takeSign() || rest.startsWith('-') || rest.startsWith('−')) return { ok: false, reason: 'INVALID' }
  const match = STRICT_AMOUNT.exec(rest)
  if (!match) return { ok: false, reason: 'INVALID' }
  const whole = (match[1] ?? '').replace(/,/g, '')
  const fraction = match[2] ?? ''
  if (!whole && !fraction) return { ok: false, reason: 'INVALID' }
  if (fraction.length > digits) return { ok: false, reason: 'TOO_MANY_DECIMALS' }
  const units = minorUnits(whole, fraction, digits)
  if (units > MAX_SAFE) return { ok: false, reason: 'TOO_LARGE' }
  if (negative && units !== ZERO && !options.allowNegative) return { ok: false, reason: 'NEGATIVE_NOT_ALLOWED' }
  const cents = Number(units)
  return { ok: true, cents: negative && cents !== 0 ? -cents : cents }
}

/** The decimal separator of a locale ("," for de-DE). */
export function decimalSeparatorFor(locale?: string): string {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'
  } catch {
    return '.'
  }
}

/**
 * Reads a pasted amount in any common style: "12,50", "1.234,56", "1 234,56", "1’234.50", "$1,234.56".
 * When both a comma and a dot are present, the last one is the decimal point. One separator that shows
 * more than once groups. One separator with exactly three digits after it groups, unless it is the
 * locale's decimal separator. Returns a plain decimal string ("1234.56"), or null when there is no digit.
 */
export function normalizePastedAmount(text: string, decimalSeparator = '.'): string | null {
  const kept = text.replace(/[^0-9.,]/g, '')
  if (!/\d/.test(kept)) return null
  const lastDot = kept.lastIndexOf('.')
  const lastComma = kept.lastIndexOf(',')
  let decimalAt = -1
  if (lastDot >= 0 && lastComma >= 0) {
    decimalAt = Math.max(lastDot, lastComma)
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ','
    const at = Math.max(lastDot, lastComma)
    const once = kept.indexOf(separator) === at
    const after = kept.length - at - 1
    if (once && (after !== 3 || separator === decimalSeparator)) decimalAt = at
  }
  if (decimalAt < 0) return kept.replace(/[.,]/g, '')
  return `${kept.slice(0, decimalAt).replace(/[.,]/g, '')}.${kept.slice(decimalAt + 1).replace(/[.,]/g, '')}`
}
