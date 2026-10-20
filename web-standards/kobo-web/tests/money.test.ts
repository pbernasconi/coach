import { describe, expect, it } from 'vitest'
import vectors from './vectors/money-format.json'
import {
  formatMoney,
  formatMoneyHidden,
  formatMoneyLabel,
  formatSignedMoney,
  MONEY_HIDDEN_LABEL,
} from '../src/lib/format/money'

const toNumber = (value: number | string): number => (typeof value === 'number' ? value : Number(value))

describe('money vectors', () => {
  it.each(vectors.cases)('$cents $currency', (vector) => {
    expect(formatMoney(vector.cents, vector.currency)).toBe(vector.text)
    expect(formatMoneyLabel(vector.cents, vector.currency)).toBe(vector.accessibilityLabel)
    expect(formatMoneyHidden(vector.currency)).toBe(vector.hiddenText)
  })

  it.each(vectors.defensiveCases.cases)('defensive $cents $currency', (vector) => {
    const cents = toNumber(vector.cents)
    expect(formatMoney(cents, vector.currency)).toBe(vector.text)
    expect(formatMoneyLabel(cents, vector.currency)).toBe(vector.accessibilityLabel)
  })

  it('uses the hidden label of the vector file', () => {
    expect(MONEY_HIDDEN_LABEL).toBe(vectors.hiddenLabel)
  })
})

describe('formatSignedMoney', () => {
  it('signs a gain and a loss, and leaves zero bare', () => {
    expect(formatSignedMoney(852)).toBe('+$8.52')
    expect(formatSignedMoney(-852)).toBe('−$8.52')
    expect(formatSignedMoney(0)).toBe('$0.00')
  })
})
