/**
 * The value logic of `InternationalPhoneInput`: a country and its national digits. This is light formatting
 * for entry, not number validation: check a number on the server (or with libphonenumber) before you use it.
 */

import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, getCountryOption, type CountryCode } from './countries'

export interface InternationalPhoneValue {
  country: CountryCode
  /** Digits only, without the calling code. */
  nationalNumber: string
}

export const EMPTY_INTERNATIONAL_PHONE: InternationalPhoneValue = { country: DEFAULT_COUNTRY, nationalNumber: '' }

/** The country that a shared calling code means when the current country does not use it. */
const MAIN_COUNTRY: Record<string, CountryCode> = {
  '1': 'US', '7': 'RU', '39': 'IT', '44': 'GB', '47': 'NO', '61': 'AU', '212': 'MA', '262': 'RE', '290': 'SH',
  '358': 'FI', '590': 'GP', '599': 'CW',
}

const callingDigits = (country: CountryCode) => getCountryOption(country).callingCode.slice(1)

/** Digits only, at most 15 (the E.164 limit). */
export function sanitizeNationalNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 15)
}

/** The shown national number: "(415) 555-0100" for +1 countries, groups of four digits for the others. */
export function formatNationalNumber(value: InternationalPhoneValue): string {
  const digits = value.nationalNumber
  if (!digits) return ''
  if (callingDigits(value.country) === '1' && digits.length <= 10) {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/**
 * Reads typed or pasted text. Text that starts with "+" picks the country from its calling code
 * ("+65 8123 4567" → Singapore, 81234567). A shared code keeps the current country when it uses that code.
 * Any other text keeps the current country and its digits.
 */
export function phoneValueFromInput(raw: string, current: CountryCode = DEFAULT_COUNTRY): InternationalPhoneValue {
  const trimmed = raw.trim()
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '')
    for (const length of [3, 2, 1]) {
      const code = digits.slice(0, length)
      const rest = digits.slice(length)
      if (!rest) continue
      const users = COUNTRY_OPTIONS.filter((option) => option.callingCode === `+${code}`)
      if (users.length === 0) continue
      const country = users.some((option) => option.country === current)
        ? current
        : (MAIN_COUNTRY[code] ?? users[0]?.country ?? current)
      return { country, nationalNumber: sanitizeNationalNumber(rest) }
    }
  }
  return { country: current, nationalNumber: sanitizeNationalNumber(raw) }
}

/**
 * "+6581234567", or null for an empty number. One leading trunk 0 is dropped ("07400…" in the UK), except
 * in Italy, where it is part of the number. This does not check that the number exists.
 */
export function toE164(value: InternationalPhoneValue): string | null {
  const code = callingDigits(value.country)
  let national = sanitizeNationalNumber(value.nationalNumber)
  if (!national) return null
  if (code !== '39' && national.startsWith('0')) national = national.slice(1)
  return national ? `+${code}${national}` : null
}
