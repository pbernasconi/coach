import { describe, expect, it } from 'vitest'
import {
  centsToDecimalString,
  decimalSeparatorFor,
  decimalStringToCents,
  formatCentsText,
  normalizePastedAmount,
  padDecimalString,
  parseCurrencyText,
  parseMoney,
} from '../src/components/fields/currencyText'
import currencyVectors from './vectors/currency-input.json'
import moneyParseVectors from './vectors/money-parse.json'
import localeVectors from './vectors/amount-locale.json'

describe('parseCurrencyText (currency-input.json)', () => {
  it.each(currencyVectors.parse)('$text', ({ text, cents, sanitizedText }) => {
    expect(parseCurrencyText(text)).toEqual({ cents, sanitizedText })
  })
})

describe('formatCentsText (currency-input.json)', () => {
  it.each(currencyVectors.formatCents)('$cents', ({ cents, text }) => {
    expect(formatCentsText(cents)).toBe(text)
  })
})

describe('parseMoney (money-parse.json)', () => {
  it.each(moneyParseVectors.cases)('$input', (vector) => {
    const allowNegative = 'allowNegative' in vector ? Boolean(vector.allowNegative) : false
    expect(parseMoney(vector.input, { allowNegative })).toEqual(vector.expected)
  })
})

describe('normalizePastedAmount (amount-locale.json)', () => {
  it.each(localeVectors.parse)('$name', ({ text, locale, cents }) => {
    const plain = normalizePastedAmount(text, decimalSeparatorFor(locale))
    expect(plain === null ? null : decimalStringToCents(plain)).toBe(cents)
  })

  it('gives null for text with no digit', () => {
    expect(normalizePastedAmount('abc')).toBeNull()
  })
})

describe('decimal strings', () => {
  it.each([
    [500, 2, false, '5'],
    [500, 2, true, '5.00'],
    [1250, 2, false, '12.5'],
    [5, 2, false, '0.05'],
    [1234, 0, false, '1234'],
    [12345, 3, true, '12.345'],
  ])('centsToDecimalString(%i, %i, %s) is %s', (cents, digits, fixed, text) => {
    expect(centsToDecimalString(cents, digits, fixed)).toBe(text)
  })

  it.each([
    ['', null],
    ['.', null],
    ['5', 500],
    ['5.', 500],
    ['.5', 50],
    ['12.345', 1234],
    ['abc', null],
  ])('decimalStringToCents(%j) is %j', (text, cents) => {
    expect(decimalStringToCents(text)).toBe(cents)
  })

  it.each([
    ['123', '123.00'],
    ['123.5', '123.50'],
    ['123.45', '123.45'],
    ['.5', '0.50'],
    ['', ''],
    ['.', '.'],
  ])('padDecimalString(%j) is %j', (text, padded) => {
    expect(padDecimalString(text)).toBe(padded)
  })

  it('pads to the currency decimals', () => {
    expect(padDecimalString('7', 0)).toBe('7')
    expect(padDecimalString('7', 3)).toBe('7.000')
  })
})
