/**
 * The countdown text of the idle warning. Units come from `Intl` in the given locale (the browser's by default).
 */

/** "1:05" for 65 seconds. */
export const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/** The seconds left at which a screen reader hears the time again. Every second would drown the page. */
export const COUNTDOWN_ANNOUNCE_AT_SECONDS: ReadonlySet<number> = new Set([120, 60, 30, 10])

const unit = (value: number, name: 'minute' | 'second', locale?: string) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'long' }).format(value)

/** "2 minutes", "1 minute 30 seconds", "10 seconds", in the locale. */
export const spokenDuration = (seconds: number, locale?: string): string => {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  if (minutes === 0) return unit(rest, 'second', locale)
  return rest === 0 ? unit(minutes, 'minute', locale) : `${unit(minutes, 'minute', locale)} ${unit(rest, 'second', locale)}`
}

/**
 * The live-region text: "Time left: 1 minute" at a milestone. Between milestones the text stays the same as at the
 * last milestone, so the live region does not speak again. Above the first milestone it is empty.
 */
export const countdownAnnouncement = (label: string, seconds: number, locale?: string): string => {
  const milestone = [...COUNTDOWN_ANNOUNCE_AT_SECONDS].sort((a, b) => a - b).find((at) => seconds <= at)
  return milestone === undefined ? '' : `${label}: ${spokenDuration(milestone, locale)}`
}
