import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { fmtDay, weight, type LiftPoint, type MainLift } from './types';

const W = 280;
const H = 84;

/** Best estimated 1RM per session as a line, with the all-time best as a dashed rule and a dot per session. */
function E1rmLine({ points, best, label }: { points: LiftPoint[]; best: number | null; label: string }) {
  if (points.length < 2) {
    return <div className="grid h-[84px] place-items-center text-xs text-[var(--viz-muted)]">One session so far. The trend starts with the next one.</div>;
  }
  const vals = points.map((p) => p.e1rm);
  const lo = Math.min(...vals) * 0.97;
  const hi = Math.max(...vals, best ?? 0) * 1.01;
  const x = (i: number) => 6 + (i / (points.length - 1)) * (W - 12);
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1).toFixed(1)},${H}L${x(0).toFixed(1)},${H}Z`;
  const id = `g-${label.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[84px] w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--sport-strength)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--sport-strength)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {best !== null && <line x1="0" x2={W} y1={y(best)} y2={y(best)} stroke="var(--viz-axis)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--sport-strength)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={`${p.sessionId}-${i}`} cx={x(i)} cy={y(p.e1rm)} r={i === points.length - 1 ? 3.5 : 2} fill={i === points.length - 1 ? 'var(--sport-strength)' : 'var(--background)'} stroke="var(--sport-strength)" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
          <title>{`${fmtDay(p.day)}: ${Math.round(p.weight)} × ${p.reps}, e1RM ${Math.round(p.e1rm)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** The most-done lifts of the last 12 weeks: estimated 1RM, its change, the best ever, and the last top set. */
export default function MainLifts({ lifts, unit, today }: { lifts: MainLift[]; unit: string; today: string }) {
  const recent = (d: string | null) => d !== null && Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`) <= 14 * 864e5;
  return (
    <section className="rounded-xl border bg-card" aria-labelledby="main-lifts">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="main-lifts" className="font-semibold">Main lifts</h2>
        <span className="text-xs text-[var(--viz-muted)]">estimated 1RM per session · dashed line is your best</span>
      </div>
      {lifts.length === 0 ? (
        <p className="p-4 text-sm text-[var(--viz-muted)]">No lifts in the last 12 weeks.</p>
      ) : (
        <div className="grid sm:grid-cols-2">
          {lifts.map((l, i) => {
            const isPr = recent(l.prDay) && l.best && l.latest && l.best.sessionId === l.latest.sessionId;
            return (
              <Link
                key={l.key}
                href={`/lift/exercises/${encodeURIComponent(l.key)}`}
                className={`group flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--viz-band)] ${i % 2 ? 'sm:border-l' : ''} ${i > 0 ? 'border-t' : ''} ${i === 1 ? 'sm:border-t-0' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--viz-ink)] group-hover:underline">{l.name}</span>
                  {isPr ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-amber-500)_18%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-amber-600)] dark:text-[var(--color-amber-400)]">
                      <Trophy aria-hidden className="h-3 w-3" /> New best
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-[var(--viz-muted)]">{l.sessions} sessions</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <b className="text-2xl font-semibold tracking-tight text-[var(--viz-ink)]">{l.latest ? Math.round(l.latest.e1rm) : '–'}</b>
                  <span className="text-sm text-[var(--viz-muted)]">{unit}</span>
                  {l.change !== null && (
                    <span className={`text-xs font-medium ${l.change >= 0 ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]'}`}>
                      {l.change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(l.change * 100))}% in 12 weeks
                    </span>
                  )}
                </div>
                <E1rmLine points={l.points} best={l.best?.e1rm ?? null} label={`${l.name}, estimated 1RM per session`} />
                <div className="flex justify-between gap-2 text-[11px] text-[var(--viz-ink-2)]">
                  <span className="truncate">
                    Last {l.latest ? `${weight(l.latest.weight, unit)} × ${l.latest.reps} · ${fmtDay(l.latest.day)}` : '–'}
                  </span>
                  <span className="shrink-0 tabular-nums">Best {l.best ? `${Math.round(l.best.e1rm)} · ${fmtDay(l.best.day)}` : '–'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
