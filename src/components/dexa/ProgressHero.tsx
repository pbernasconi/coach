import { distanceToHealthy, perYear, zoneOf, type HealthRange } from '@/lib/vitals/dexa-health.mjs';
import BandChart, { type Point } from './BandChart';
import { ZoneChip, monthYear } from './Zones';

const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;

/**
 * The page's lead: body fat now, how it moved since the first scan and per year, where it sits in the healthy range
 * for the athlete's sex and age, and the line of every scan over those ranges.
 */
export default function ProgressHero({ points, range }: { points: Point[]; range: HealthRange }) {
  const last = points.at(-1);
  if (!last) return null;
  const first = points.length > 1 ? points[0] : null;
  const change = first ? last.value - first.value : null;
  const pace = first ? perYear(first, last) : null;
  const zone = zoneOf(range, last.value);
  const away = distanceToHealthy(range, last.value);
  const healthy = range.zones.filter((z) => z.tone === 'good');
  const healthyText = healthy.length ? `${healthy[0].from}–${healthy[healthy.length - 1].to}%` : '';
  const good = change === null ? null : change < 0;
  return (
    <section aria-labelledby="dexa-hero" className="grid gap-6 rounded-2xl bg-[var(--viz-surface)] p-5 shadow-sm ring-1 ring-[var(--viz-grid)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)] lg:items-center">
      <div className="space-y-3">
        <h2 id="dexa-hero" className="text-sm font-medium text-[var(--viz-ink-2)]">Body fat</h2>
        <p className="text-5xl font-bold tabular-nums tracking-tight text-[var(--viz-ink)]">
          {last.value.toFixed(1)}
          <span className="text-2xl font-medium text-[var(--viz-muted)]">%</span>
        </p>
        {change !== null && first && (
          <p className="text-lg font-semibold" style={{ color: good ? 'var(--viz-up)' : 'var(--viz-down)' }}>
            {signed(change, 1)} points since {monthYear(first.date)}
          </p>
        )}
        <p className="text-sm text-[var(--viz-ink-2)]">
          {pace !== null && <>{signed(pace, 1)} points a year. </>}
          {away > 0 ? `${away.toFixed(1)} points from the healthy range.` : 'In the healthy range.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ZoneChip tone={zone.tone}>{zone.label}</ZoneChip>
          <span className="text-xs text-[var(--viz-muted)]">Healthy {healthyText} · {range.source}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="sm:hidden">
          <BandChart points={points} range={range} width={360} height={230} unit="%" digits={1} label="Body fat" />
        </div>
        <div className="hidden sm:block">
          <BandChart points={points} range={range} width={680} height={280} unit="%" digits={1} label="Body fat" />
        </div>
      </div>
    </section>
  );
}
