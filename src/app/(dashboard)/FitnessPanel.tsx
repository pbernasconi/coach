import Link from 'next/link';
import { Bike, Footprints, Info as InfoIcon } from 'lucide-react';
import { HelpTooltip } from '@kobo/web';
import { RUN_DISTANCES } from '@/lib/performance/peaks.mjs';
import { loadTiles, peakText, rampTiles, recoveryRows, shortDate } from '@/lib/performance/display.mjs';
import type { Pmc } from '@/lib/performance/projection';
import type { RecentPeak } from '@/lib/performance/peaks';
import type { RecoveryToday } from '@/lib/vitals/garmin-pages';

const TONE = { good: 'var(--viz-good)', warn: 'var(--color-amber-500)', bad: 'var(--viz-down)', neutral: 'var(--viz-muted)' } as const;
const meters = new Map(RUN_DISTANCES.map((d: { span: number; meters: number; label: string }) => [d.span, d]));
const powerLabel = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`);

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">{children}</span>
);

/** An (i) that shows a short note on hover. */
const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <HelpTooltip label={label} icon={<InfoIcon aria-hidden />} className="normal-case tracking-normal">{children}</HelpTooltip>
);

/**
 * Recovery today (the header chips before 2026-10-21): Garmin readiness, HRV status and sleep. What each means is in
 * an (i) tooltip. Links to today's health page.
 */
export function RecoveryCard({ recovery, today }: { recovery: RecoveryToday | null; today: string }) {
  const rows = recoveryRows(recovery);
  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="recovery-today">
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 id="recovery-today" className="font-semibold">Recovery today</h2>
        <Link href={`/health/day/${today}`} className="text-xs text-[var(--viz-muted)] hover:text-foreground">Details →</Link>
      </div>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2.5 px-4 py-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[r.tone] }} aria-hidden />
              <span className="text-[var(--viz-ink-2)]">{r.label}</span>
              <Info label={`About ${r.label}`}>{r.note}</Info>
              <b className="ml-auto tabular-nums">{r.valueText}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-[var(--viz-muted)]">No Garmin data today.</p>
      )}
    </section>
  );
}

/** CTL over one window as a filled area, scaled to the window's own range so small changes show. */
function MiniArea({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <div className="h-14 rounded-sm bg-[var(--viz-band)]" aria-hidden />;
  const W = 200;
  const H = 56;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * 0.15;
  const y = (v: number) => H - ((v - (lo - pad)) / (hi - lo + 2 * pad || 1)) * H;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={label}>
      <path d={`M0,${H}L${pts.join('L')}L${W},${H}Z`} fill="var(--viz-ctl)" opacity={0.18} />
      <path d={`M${pts.join('L')}`} fill="none" stroke="var(--viz-ctl)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const MEDAL = { 1: '#c9a227', 2: '#9a9993', 3: '#b0713d' } as Record<number, string>;

function Medal({ rank }: { rank: number }) {
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
      style={{ background: MEDAL[rank] ?? 'var(--viz-muted)' }}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

function peakLines(p: RecentPeak) {
  if (p.metric === 'power') return { main: `${Math.round(p.value)} W`, sub: `${powerLabel(p.span)} power` };
  const d = meters.get(p.span);
  const t = peakText('run', d?.meters ?? p.span, p.value);
  return { main: t.main, sub: `${d?.label ?? `${p.span} m`}${t.sub ? ` · ${t.sub} /km` : ''}` };
}

/**
 * The Intervals.icu-style fitness panel: fatigue, fitness and form today with what they mean, how fitness moved over
 * 7, 28, 90 and 365 days (mini charts of CTL), and the recent peak performances that made a top 3.
 */
export default function FitnessPanel({ pmc, peaks }: { pmc: Pmc | null; peaks: RecentPeak[] | null }) {
  const last = pmc?.days.filter((d) => !d.projected).at(-1) ?? null;
  const tiles = loadTiles(last);
  const ramps = pmc ? rampTiles(pmc.ramp) : [];
  const ctl = pmc?.fitness.map((d) => d.ctl) ?? [];
  const byDate = new Map<string, RecentPeak[]>();
  for (const p of peaks ?? []) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);

  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="fitness-panel" data-testid="fitness-panel">
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 id="fitness-panel" className="inline-flex items-center gap-1.5 font-semibold">
          Fitness
          <Info label="About fitness, fatigue and form">
            Fitness: average daily training load over 6 weeks. Fatigue: the same over 1 week. Form: fitness minus fatigue.
          </Info>
        </h2>
        <Link href="#fitness" className="text-xs text-[var(--viz-muted)] hover:text-foreground">Chart ↓</Link>
      </div>

      {tiles ? (
        <div className="px-4 pb-4 pt-4">
          <div className="grid grid-cols-3 overflow-hidden rounded-md border">
            {tiles.map((t) => {
              const main = t.key === 'fitness';
              const color = t.key === 'fatigue' ? 'var(--viz-atl)' : t.key === 'fitness' ? 'var(--viz-ctl)' : 'var(--viz-ink)';
              return (
                <div
                  key={t.key}
                  className={`flex flex-col items-center px-1 py-2.5 text-center ${main ? 'text-white' : 'border-l first:border-l-0'}`}
                  style={main ? { background: 'var(--viz-ctl)' } : undefined}
                >
                  <span className="text-3xl font-semibold tabular-nums tracking-tight" style={main ? undefined : { color }}>{t.valueText}</span>
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wide ${main ? 'text-white/85' : 'text-[var(--viz-muted)]'}`}
                    title={t.meaning ? `${t.zone}: ${t.meaning}` : undefined}
                  >
                    {t.label}{t.zone ? ` · ${t.zone}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-[var(--viz-muted)]">No training load yet.</p>
      )}

      {pmc && (
        <div className="border-t px-4 py-4">
          <Kicker>
            Fitness ramp
            <Info label="About the fitness ramp">Fitness gained or lost over each period. More than +8 a week raises injury risk.</Info>
          </Kicker>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {ramps.map((r) => (
              <div key={r.days} className="min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className={`text-lg font-semibold tabular-nums ${r.warn ? 'text-[var(--viz-down)]' : 'text-[var(--viz-ctl)]'}`}
                    title={r.perWeekText ? `${r.perWeekText} a week · ${r.levelText}` : r.levelText}
                  >
                    {r.warn && <span aria-hidden>▲ </span>}
                    {r.changeText}
                  </span>
                  <span className="truncate text-[11px] text-[var(--viz-muted)]">{r.title}</span>
                </div>
                <MiniArea values={ctl.slice(-(r.days + 1))} label={`Fitness over the ${r.title.toLowerCase()}: ${r.changeText}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t px-4 py-3">
        <div className="mb-1 flex items-baseline justify-between">
          <Kicker>
            Recent peaks
            <Info label="About recent peaks">Efforts from the last 4 weeks in your top 3 all time, this year or the last 90 days.</Info>
          </Kicker>
          <Link href="/trends#peaks" className="text-xs text-[var(--viz-muted)] hover:text-foreground">All peaks →</Link>
        </div>
        {peaks == null ? (
          <p className="py-1 text-sm text-[var(--viz-muted)]">Peaks could not load.</p>
        ) : byDate.size === 0 ? (
          <p className="py-1 text-sm text-[var(--viz-muted)]">None in the last 4 weeks.</p>
        ) : (
          [...byDate].map(([date, list]) => (
            <div key={date} className="py-1">
              <div className="pb-1 pt-1 text-xs text-[var(--viz-ink-2)]">{shortDate(date)}</div>
              {list.map((p) => {
                const { main, sub } = peakLines(p);
                const Icon = p.metric === 'power' ? Bike : Footprints;
                return (
                  <Link
                    key={`${p.activityId}-${p.metric}-${p.span}`}
                    href={`/activities/${p.activityId}`}
                    title={p.name ?? undefined}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--viz-band)]"
                  >
                    <Medal rank={p.rank} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tabular-nums leading-tight">{main}</span>
                      <span className="block truncate text-xs tabular-nums text-[var(--viz-ink-2)]">{sub}</span>
                    </span>
                    <span className="text-right text-[11px] leading-tight text-[var(--viz-muted)]">{p.windowLabel}</span>
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: p.metric === 'power' ? 'var(--sport-ride)' : 'var(--sport-run)' }}
                      aria-label={p.metric === 'power' ? 'Ride' : 'Run'}
                    />
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
