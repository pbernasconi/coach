import { describe, expect, it } from 'vitest'
import { COUNTRY_OPTIONS, flagEmoji, getCountryOption } from '../src/components/fields/countries'
import { formatNationalNumber, phoneValueFromInput, sanitizeNationalNumber, toE164 } from '../src/components/fields/phoneNumber'
import flagVectors from './vectors/flag-emoji.json'

describe('flagEmoji (flag-emoji.json)', () => {
  it.each(flagVectors.cases)('$code', ({ code, flag }) => {
    expect(flagEmoji(code)).toBe(flag)
  })

  it.each(flagVectors.invalid)('gives no flag for %j', (code) => {
    expect(flagEmoji(code)).toBe('')
  })
})

describe('countries', () => {
  it('names every country, sorted, with a calling code', () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(230)
    for (const option of COUNTRY_OPTIONS) {
      expect(option.name).not.toBe(option.country)
      expect(option.callingCode).toMatch(/^\+\d{1,3}$/)
    }
    const names = COUNTRY_OPTIONS.map((option) => option.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('finds a code in any case, and falls back to the United States', () => {
    expect(getCountryOption('sg')).toEqual({ country: 'SG', name: 'Singapore', callingCode: '+65' })
    expect(getCountryOption('ZZ').country).toBe('US')
  })
})

describe('phone value', () => {
  it.each([
    ['+65 8123 4567', 'US', { country: 'SG', nationalNumber: '81234567' }],
    ['+44 7400 123456', 'US', { country: 'GB', nationalNumber: '7400123456' }],
    ['+44 7700 900123', 'JE', { country: 'JE', nationalNumber: '7700900123' }],
    ['+1 415 555 0100', 'CA', { country: 'CA', nationalNumber: '4155550100' }],
    ['+1 415 555 0100', 'SG', { country: 'US', nationalNumber: '4155550100' }],
    ['+81 90 1234 5678', 'US', { country: 'JP', nationalNumber: '9012345678' }],
    ['(530) 555-0142', 'US', { country: 'US', nationalNumber: '5305550142' }],
    ['+', 'GB', { country: 'GB', nationalNumber: '' }],
  ])('reads %j with %s', (raw, current, expected) => {
    expect(phoneValueFromInput(raw, current)).toEqual(expected)
  })

  it.each([
    [{ country: 'US', nationalNumber: '' }, ''],
    [{ country: 'US', nationalNumber: '415' }, '415'],
    [{ country: 'US', nationalNumber: '4155' }, '(415) 5'],
    [{ country: 'US', nationalNumber: '4155550100' }, '(415) 555-0100'],
    [{ country: 'SG', nationalNumber: '81234567' }, '8123 4567'],
  ])('formats %j as %j', (value, text) => {
    expect(formatNationalNumber(value)).toBe(text)
  })

  it.each([
    [{ country: 'US', nationalNumber: '4155550100' }, '+14155550100'],
    [{ country: 'GB', nationalNumber: '07400123456' }, '+447400123456'],
    [{ country: 'IT', nationalNumber: '0612345678' }, '+390612345678'],
    [{ country: 'US', nationalNumber: '' }, null],
  ])('writes %j as %j', (value, e164) => {
    expect(toE164(value)).toBe(e164)
  })

  it('keeps at most 15 digits', () => {
    expect(sanitizeNationalNumber('1234567890123456789')).toBe('123456789012345')
  })
})
