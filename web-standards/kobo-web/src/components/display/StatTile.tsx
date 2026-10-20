import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TONE_CLASS, type Tone } from '../../lib/tone'

/** A change under a stat. It always has a glyph, so it never reads by colour alone. */
export interface StatDelta {
  text: string
  tone: Tone
  direction: 'up' | 'down' | 'flat'
}

/**
 * The delta of a signed change. `goodWhen: 'down'` is for a value where less is better (cost, errors, wait time).
 *
 *     statDelta(-0.4, formatDelta(-0.4, 1, ' pts'), { goodWhen: 'down' })   → success tone, down glyph
 */
export function statDelta(change: number, text: string, options: { goodWhen?: 'up' | 'down' } = {}): StatDelta {
  const { goodWhen = 'up' } = options
  if (change === 0 || !Number.isFinite(change)) return { text, tone: 'neutral', direction: 'flat' }
  const direction = change > 0 ? 'up' : 'down'
  return { text, tone: direction === goodWhen ? 'success' : 'danger', direction }
}

const GLYPH = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const

export interface StatTileProps {
  label: React.ReactNode
  /** The formatted value ("12.4K", "$1.2B"). Format it with lib/format. */
  value: React.ReactNode
  unit?: React.ReactNode
  delta?: StatDelta
  /** A short note under the value ("vs last month"). */
  note?: React.ReactNode
  className?: string
}

/**
 * A card with a caption, a big value, an optional unit and an optional delta.
 *
 *     <StatTile label="Open tasks" value="18" unit="/ 24" delta={statDelta(3, '+3')} note="this week" />
 */
export function StatTile({ label, value, unit, delta, note, className }: StatTileProps) {
  const Glyph = delta ? GLYPH[delta.direction] : null
  return (
    <div className={cn('flex flex-col gap-1 rounded-card bg-surface p-card shadow-card', className)}>
      <div className="text-footnote font-semibold text-ink-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-title2 tabular-nums text-ink">{value}</span>
        {unit && <span className="text-subhead font-semibold text-ink-muted">{unit}</span>}
      </div>
      {(delta || note) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-footnote">
          {delta && Glyph && (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', TONE_CLASS[delta.tone].text)}>
              <Glyph aria-hidden="true" className="size-3.5" />
              {delta.text}
            </span>
          )}
          {note && <span className="text-ink-muted">{note}</span>}
        </div>
      )}
    </div>
  )
}
