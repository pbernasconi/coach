import Link from 'next/link';
import type { Body } from '@/lib/vitals/garmin-pages';
import { MUSCLE_TARGET, daysAgoText, e1rmText, liftChangeText, setsText, shortDate, weightChange } from '@/lib/performance/display.mjs';

type MuscleRow = { muscle: string; sets: number; status: string };
type TopLift = { key: string; name: string; points: { e1rm: number }[]; latest: number | null; change: number | null };
type SessionRef = { id: string; day: string; title: string };
export type LiftSummary = {
  thisWeek: MuscleRow[];
  top: TopLift[];
  unit: string;
  hasData: boolean;
  last?: SessionRef | null;
  daysSince?: number | null;
  next?: SessionRef | null;
  prs?: number;
};

const BAND = MUSCLE_TARGET; // weekly hard sets per muscle
const BAR_MAX = 25;
const ARMS = ['biceps', 'triceps'];

/** A small trend line scaled to its own range (a weight series sits far from zero). */
function Trend({ values, color, height = 56, label }: { values: number[]; color: string; height?: number; label: string }) {
  if (values.length < 2) return null;
  const W = 300;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, height - 4 - ((v - lo) / (hi - lo || 1)) * (height - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  );
}

function Spark({ points }: { points: { e1rm: number }[] }) {
  if (points.length < 2) return <span className="w-16 text-right text-[11px] text-[var(--viz-muted)]">1 session</span>;
  const W = 64;
  const H = 20;
  const vals = points.map((p) => p.e1rm);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-5 w-16 shrink-0" aria-hidden>
      <path d={d} fill="none" stroke="var(--sport-strength)" strokeWidth="1.75" />
    </svg>
  );
}

function SetsBar({ name, sets }: { name: string; sets: number }) {
  const pct = (v: number) => `${(Math.min(v, BAR_MAX) / BAR_MAX) * 100}%`;
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
      <span className="font-medium capitalize">{name}</span>
      <div className="relative h-2.5 overflow-hidden rounded-sm bg-muted" role="img" aria-label={`${name}: ${sets} hard sets, target ${BAND.min} to ${BAND.max}`}>
        <div className="absolute inset-y-0 bg-[var(--viz-good)]/20" style={{ left: pct(BAND.min), width: `${((BAND.max - BAND.min) / BAR_MAX) * 100}%` }} />
        <div className="relative h-full rounded-sm bg-[var(--sport-strength)]" style={{ width: pct(sets) }} />
      </div>
      <span className="text-right tabular-nums">{setsText(sets)}</span>
    </div>
  );
}

/**
 * The home page's "Lean and strong" rail, for the body-composition and strength goals: weight and body fat (scale,
 * through the vitals push), hard sets for the arms this week, the main lifts' estimated 1RM, and strength sessions.
 */
export default function LeanStrong({
  body, lift, strength,
}: {
  body: Body | null;
  lift: LiftSummary | null;
  strength: { done: number; target: number };
}) {
  const sets = (m: string) => lift?.thisWeek.find((r) => r.muscle.toLowerCase() === m)?.sets ?? 0;
  const change = weightChange(body?.change4w ?? null);
  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border bg-card" aria-labelledby="lean-strong">
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 id="lean-strong" className="font-semibold">Lean and strong</h2>
        <Link href="/lift" className="text-xs text-[var(--viz-muted)] hover:text-foreground">Lift →</Link>
      </div>

      <Link href="/health" className="flex flex-col gap-1.5 border-b px-4 py-4 transition-colors hover:bg-[var(--viz-band)]">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">Weight</span>
        {body?.weight ? (
          <>
            <span className="tabular-nums">
              <b className="text-3xl font-semibold tracking-tight">{body.weight.value.toFixed(1)}</b>{' '}
              <span className="text-sm text-[var(--viz-muted)]">kg</span>
            </span>
            <span className="text-xs tabular-nums text-[var(--viz-ink-2)]">
              {change ? (
                <>
                  <span className={change.tone === 'good' ? 'text-[var(--viz-good)]' : 'text-[var(--viz-down)]'}>{change.text}</span>{' '}
                  in 4 weeks · {change.perWeekText}
                </>
              ) : (
                `as of ${shortDate(body.weight.date)}`
              )}
            </span>
            <Trend values={body.series.map((p) => p.value)} color="var(--viz-ink)" label="Weight, last 12 weeks" />
            <span className="flex justify-between text-xs">
              <span className="text-[var(--viz-muted)]">Body fat</span>
              <b className="tabular-nums">{body.bodyFat ? `${body.bodyFat.value.toFixed(1)} %` : '–'}</b>
            </span>
          </>
        ) : (
          <span className="text-sm text-[var(--viz-muted)]">No weight in the last 12 weeks.</span>
        )}
      </Link>

      <div className="flex flex-col gap-2.5 border-b px-4 py-4">
        <span className="flex justify-between text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">
          <Link href="/lift#muscles" className="hover:text-foreground">Arms · hard sets this week</Link>
          <span className="normal-case tracking-normal">target {BAND.min}–{BAND.max}</span>
        </span>
        {ARMS.map((m) => <SetsBar key={m} name={m} sets={sets(m)} />)}
      </div>

      <div className="flex flex-col border-b px-4 py-3">
        <span className="mb-1 flex justify-between text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">
          <span>Main lifts · e1RM</span>
          <span className="normal-case tracking-normal">12 weeks</span>
        </span>
        {lift?.hasData && lift.top.length > 0 ? (
          lift.top.map((l) => (
            <Link key={l.key} href={`/lift/exercises/${encodeURIComponent(l.key)}`} className="flex min-h-9 items-center gap-2 text-sm hover:bg-muted/40">
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <Spark points={l.points} />
              <span className="w-16 text-right font-semibold tabular-nums">{e1rmText(l.latest, lift.unit)}</span>
              <span className={`w-10 text-right text-xs tabular-nums ${l.change == null ? 'text-[var(--viz-muted)]' : l.change >= 0 ? 'text-[var(--viz-good)]' : 'text-[var(--viz-down)]'}`}>
                {liftChangeText(l.change)}
              </span>
            </Link>
          ))
        ) : (
          <span className="py-1 text-sm text-[var(--viz-muted)]">No Lift sessions in 12 weeks.</span>
        )}
      </div>

      <Link href="/lift" className="flex justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--viz-band)]">
        <span className="text-[var(--viz-muted)]">Strength sessions</span>
        <b className="tabular-nums">{strength.done} / {strength.target} this week</b>
      </Link>
      {(lift?.last || lift?.next) && (
        <div className="grid grid-cols-2 border-t text-xs">
          {lift.last ? (
            <Link href={`/lift/sessions/${lift.last.id}`} className="min-w-0 px-4 py-2.5 transition-colors hover:bg-[var(--viz-band)]">
              <span className="block text-[11px] uppercase tracking-wide text-[var(--viz-muted)]">Last lift</span>
              <span className={`block truncate font-medium ${lift.daysSince != null && lift.daysSince >= 10 ? 'text-[var(--viz-down)]' : ''}`}>
                {daysAgoText(lift.daysSince)}
              </span>
              <span className="block truncate text-[var(--viz-ink-2)]">{lift.last.title || 'Session'}{lift.prs ? ` · ${lift.prs} PR${lift.prs > 1 ? 's' : ''}` : ''}</span>
            </Link>
          ) : <span />}
          {lift.next ? (
            <Link href={`/lift/sessions/${lift.next.id}`} className="min-w-0 border-l px-4 py-2.5 transition-colors hover:bg-[var(--viz-band)]">
              <span className="block text-[11px] uppercase tracking-wide text-[var(--viz-muted)]">Next lift</span>
              <span className="block truncate font-medium">{shortDate(lift.next.day)}</span>
              <span className="block truncate text-[var(--viz-ink-2)]">{lift.next.title || 'Session'}</span>
            </Link>
          ) : (
            <Link href="/lift" className="min-w-0 border-l px-4 py-2.5 text-[var(--viz-ink-2)] transition-colors hover:bg-[var(--viz-band)]">
              <span className="block text-[11px] uppercase tracking-wide text-[var(--viz-muted)]">Next lift</span>
              <span className="block">Not planned yet →</span>
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
