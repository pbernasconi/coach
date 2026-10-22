import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import { zoneOf, type HealthRange } from '@/lib/vitals/dexa-health.mjs';
import { ZONE_FILL, ZONE_INK, monthYY } from './Zones';

export type RangeRow = { range: HealthRange; now: number | null; then: number | null };

const fmt = (r: HealthRange, v: number) => (r.unit === 'Z' ? `Z ${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}` : `${v.toFixed(r.digits)}${r.unit === '%' ? '%' : ` ${r.unit}`}`);

/**
 * Each measure on its healthy range for the athlete's sex and age: the zones as a bar, a filled dot for now and a
 * hollow one for the first scan, and the zone's name in words. Sources are in each row's tooltip.
 */
export default function HealthRanges({ rows, thenDate }: { rows: RangeRow[]; thenDate: string | null }) {
  const shown = rows.filter((r): r is RangeRow & { now: number } => r.now !== null);
  if (!shown.length) return null;
  return (
    <div className="space-y-5">
      <ul className="space-y-5">
        {shown.map(({ range, now, then }) => {
          const zone = zoneOf(range, now);
          const pos = (v: number) => `${Math.max(1.5, Math.min(98.5, ((v - range.min) / (range.max - range.min)) * 100))}%`;
          return (
            <li key={range.key} className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-center">
              <div>
                <p className="flex items-center gap-1 text-[15px] font-medium text-[var(--viz-ink)]">
                  {range.label}
                  <HelpTooltip label={`About ${range.label}`} icon={<Info aria-hidden />}>{range.source}</HelpTooltip>
                </p>
                <p className="text-sm tabular-nums">
                  <span className="text-[var(--viz-ink)]">{fmt(range, now)}</span>
                  <span style={{ color: ZONE_INK[zone.tone] }}> · {zone.label}</span>
                </p>
              </div>
              <div className="space-y-1">
                <div className="relative h-3 overflow-visible rounded-full" aria-hidden>
                  <div className="absolute inset-0 flex overflow-hidden rounded-full">
                    {range.zones.map((z) => (
                      <div key={z.label} style={{ width: `${((Math.min(z.to, range.max) - Math.max(z.from, range.min)) / (range.max - range.min)) * 100}%`, background: ZONE_FILL[z.tone] }} />
                    ))}
                  </div>
                  {then !== null && Math.abs(then - now) > 10 ** -range.digits && (
                    <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--viz-muted)] bg-[var(--viz-surface)]" style={{ left: pos(then) }} title={thenDate ? `${monthYY(thenDate)}: ${fmt(range, then)}` : undefined} />
                  )}
                  <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--viz-surface)] bg-[var(--viz-ink)] shadow-sm" style={{ left: pos(now) }} />
                </div>
                <div className="relative h-4 text-[11px] text-[var(--viz-muted)]">
                  {range.zones.slice(1).map((z) => (
                    <span key={z.label} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pos(z.from) }}>
                      {range.unit === 'Z' ? (z.from > 0 ? `+${z.from}` : z.from === 0 ? '0' : `−${Math.abs(z.from)}`) : z.from}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {thenDate && (
        <p className="flex items-center gap-4 text-xs text-[var(--viz-muted)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--viz-ink)]" />Now</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--viz-muted)]" />{monthYY(thenDate)}</span>
        </p>
      )}
    </div>
  );
}
