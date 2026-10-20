/**
 * The closed set of tones a component can take (Kobo `Tone`; Kobo calls the brand tone `accent`).
 * Meaning never relies on colour alone: every toned component also shows an icon or a label.
 */
export const TONES = ['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as const
export type Tone = (typeof TONES)[number]

/** The token classes of each tone. `container` is the fill and border; `text` is the ink. */
export const TONE_CLASS: Record<Tone, { container: string; text: string; solid: string }> = {
  neutral: { container: 'bg-neutral-soft border-neutral-line', text: 'text-neutral-ink', solid: 'bg-neutral-ink' },
  brand: { container: 'bg-brand-soft border-brand-soft', text: 'text-brand-ink', solid: 'bg-brand' },
  success: { container: 'bg-success-soft border-success-line', text: 'text-success-ink', solid: 'bg-success-ink' },
  warning: { container: 'bg-warning-soft border-warning-line', text: 'text-warning-ink', solid: 'bg-warning-ink' },
  danger: { container: 'bg-danger-soft border-danger-line', text: 'text-danger-ink', solid: 'bg-danger-ink' },
  info: { container: 'bg-info-soft border-info-line', text: 'text-info-ink', solid: 'bg-info-ink' },
}

/** Fill, border and ink of a tone as one class string. */
export function toneClass(tone: Tone): string {
  return `${TONE_CLASS[tone].container} ${TONE_CLASS[tone].text}`
}
