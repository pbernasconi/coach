import { TEXT_ROLES, TONES, cn, toneClass } from '../../src'
import { Grid, Specimen } from './Specimen'

const SURFACES = ['bg-canvas', 'bg-surface', 'bg-surface-raised', 'bg-surface-sunken', 'bg-brand', 'bg-brand-soft'] as const
const INKS = ['text-ink', 'text-ink-muted', 'text-ink-faint', 'text-brand-ink'] as const
const VIZ = ['bg-viz-1', 'bg-viz-2', 'bg-viz-3', 'bg-viz-4', 'bg-viz-5', 'bg-viz-6', 'bg-viz-7', 'bg-viz-8'] as const
const TYPE: Record<(typeof TEXT_ROLES)[number], string> = {
  display: 'text-display',
  title: 'text-title',
  title2: 'text-title2',
  headline: 'text-headline',
  reading: 'text-reading',
  body: 'text-body',
  subhead: 'text-subhead',
  footnote: 'text-footnote',
  caption: 'text-caption',
}

/** Colour roles, tones, chart hues and type roles. */
export function TokensSection() {
  return (
    <Grid>
      <Specimen title="Surfaces">
        {SURFACES.map((surface) => (
          <div key={surface} className="flex flex-col items-center gap-1">
            <div className={cn('size-12 rounded-control border border-line', surface)} />
            <code className="text-caption text-ink-muted">{surface.replace('bg-', '')}</code>
          </div>
        ))}
      </Specimen>
      <Specimen title="Ink">
        {INKS.map((ink) => (
          <span key={ink} className={cn('text-headline', ink)}>
            {ink.replace('text-', '')}
          </span>
        ))}
      </Specimen>
      <Specimen title="Tones (ink on soft, with a line)">
        {TONES.map((tone) => (
          <span key={tone} className={cn('rounded-badge border px-2 py-1 text-footnote font-semibold', toneClass(tone))}>
            {tone}
          </span>
        ))}
      </Specimen>
      <Specimen title="Chart hues, in order">
        {VIZ.map((hue, index) => (
          <div key={hue} className="flex flex-col items-center gap-1">
            <div className={cn('size-8 rounded-inner', hue)} />
            <code className="text-caption text-ink-muted">{index + 1}</code>
          </div>
        ))}
      </Specimen>
      <Specimen title="Type roles" wide>
        <div className="flex w-full flex-col gap-2">
          {TEXT_ROLES.map((role) => (
            <div key={role} className="flex items-baseline gap-4">
              <code className="w-20 shrink-0 text-caption text-ink-muted">{role}</code>
              <span className={TYPE[role]}>The quick brown fox, 1,234.56</span>
            </div>
          ))}
        </div>
      </Specimen>
    </Grid>
  )
}
