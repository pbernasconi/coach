/** The dot that hides a character. */
export const MASK_DOT = '•'

/**
 * Hides all but the last `visible` characters behind two dots: ("A1B2C3D4", 4) → "••C3D4".
 * A value with `visible` characters or less is hidden fully, so the mask never shows the whole value.
 */
export function maskValue(value: string, visible = 4, dots = 2): string {
  const shown = Math.max(0, Math.floor(visible))
  const mask = MASK_DOT.repeat(Math.max(1, dots))
  if (shown === 0 || value.length <= shown) return MASK_DOT.repeat(Math.max(4, dots))
  return mask + value.slice(-shown)
}
