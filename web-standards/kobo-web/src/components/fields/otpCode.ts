/**
 * Keeps the digits of a typed, pasted or autofilled code, then caps them at `length`.
 * It strips first and caps second, so "123 456" gives "123456", not "12345".
 */
export function sanitizeOtp(text: string, length: number): string {
  return text.replace(/\D/g, '').slice(0, length)
}
