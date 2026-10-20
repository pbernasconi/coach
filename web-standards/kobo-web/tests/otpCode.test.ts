import { describe, expect, it } from 'vitest'
import vectors from './vectors/otp-input.json'
import { sanitizeOtp } from '../src/components/fields/otpCode'

describe('sanitizeOtp vectors', () => {
  it.each(vectors.sanitize)('$text (length $length) gives $code', ({ text, length, code }) => {
    expect(sanitizeOtp(text, length)).toBe(code)
  })
})
