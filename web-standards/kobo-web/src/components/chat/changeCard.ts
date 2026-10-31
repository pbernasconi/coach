import type { ReactNode } from 'react'

import type { Tone } from '../../lib/tone'

/** How a row changes: moved here, new, skipped or removed, or edited in place. */
export type ChatChangeTone = 'move' | 'new' | 'skip' | 'change'

/** One row of a change card, as it will be after Apply. */
export type ChatChangeRow = { title: string; meta?: string | null; tag?: string | null; tone?: ChatChangeTone; icon?: ReactNode }

/** The rows of one day (or group) of a change card. */
export type ChatChangeDay = { label: string; rows: ChatChangeRow[] }

/** Where a change card is. `stale`: the plan moved on before Apply, so the card no longer holds. */
export type ChatChangeStatus = 'open' | 'applied' | 'undone' | 'dismissed' | 'stale'

/** The tone of each row tag. The tag's words carry the meaning. */
export const CHANGE_TAG_TONE: Record<ChatChangeTone, Tone> = { move: 'info', new: 'success', skip: 'neutral', change: 'warning' }

/** The status pill of a decided card, or null while it is open. */
export function changeStatusPill(status: ChatChangeStatus): { label: string; tone: Tone } | null {
  switch (status) {
    case 'applied': return { label: 'Applied', tone: 'success' }
    case 'undone': return { label: 'Undone', tone: 'neutral' }
    case 'dismissed': return { label: 'Dismissed', tone: 'neutral' }
    case 'stale': return { label: 'Out of date', tone: 'warning' }
    default: return null
  }
}

/** "Apply" for one change, "Apply 3 changes" for more. `count` overrides the row count (a row can hold two changes). */
export function applyLabel(days: ChatChangeDay[], count?: number | null): string {
  const n = count ?? days.reduce((sum, d) => sum + d.rows.length, 0)
  return n > 1 ? `Apply ${n} changes` : 'Apply'
}
