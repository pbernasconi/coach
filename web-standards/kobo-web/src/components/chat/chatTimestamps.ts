/** A gap this long between two messages gets a time line between them. */
export const TIMESTAMP_GAP_MS = 60 * 60_000

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/**
 * Which messages get a time line above them (Kobo ChatTranscript.timestamps): the first, then any after a gap of an
 * hour or more or on a new day. Messages without a time never get one.
 */
export function timestampIndexes(times: (string | null)[]): Set<number> {
  const out = new Set<number>()
  let last: Date | null = null
  times.forEach((t, i) => {
    if (!t) return
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return
    if (!last || d.getTime() - last.getTime() >= TIMESTAMP_GAP_MS || !sameDay(d, last)) out.add(i)
    last = d
  })
  return out
}

/** "Today 11:33", "Yesterday 09:05", "Tuesday 18:20" (this week), else "Oct 26 at 11:33". In the viewer's zone. */
export function timestampLabel(iso: string, now: Date = new Date(), locale = 'en-US'): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return `Today ${time}`
  if (sameDay(d, yesterday)) return `Yesterday ${time}`
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days >= 0 && days < 6) return `${d.toLocaleDateString(locale, { weekday: 'long' })} ${time}`
  return `${d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} at ${time}`
}
