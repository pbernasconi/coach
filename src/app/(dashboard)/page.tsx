import Link from 'next/link';
import { cookies } from 'next/headers';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadPerformance, type WeekStats } from '@/lib/performance/queries';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { muscleSets, topLifts } from '@/lib/lift-dashboard/stats.mjs';
import { loadRange, userSettings } from '@/lib/plan/month';
import { loadForecast, placeFrom } from '@/lib/plan/weather';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import SectionError from '@/components/SectionError';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadPmc } from '@/lib/performance/projection';
import { loadBody, loadRecoveryToday } from '@/lib/vitals/garmin-pages';
import { hrvStatusLabel } from '@/lib/vitals/garmin-training.mjs';
import PmcSection from '@/components/performance/PmcSection';
import { sql } from '@/db';
import { loadGoals, measureGoals } from '@/lib/goals/goals.mjs';
import GoalsCard from './GoalsCard';
import HomeWeek from './HomeWeek';
import LeanStrong from './LeanStrong';

export const dynamic = 'force-dynamic';

function zone(tz: string | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const minutes = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`;
const sum = (ws: WeekStats[], key: keyof WeekStats) => ws.reduce((n, w) => n + Number(w[key]), 0);
function pace(min: number, km: number) {
  if (!km) return null;
  const s = Math.round((min * 60) / km);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}
const READINESS: [number, string][] = [[95, 'Prime'], [75, 'High'], [50, 'Moderate'], [25, 'Low'], [0, 'Poor']];
const band = (v: number) => READINESS.find(([min]) => v >= min)?.[1] ?? '';
const TONE = { good: 'var(--viz-good)', warn: 'var(--color-amber-500)', bad: 'var(--viz-down)', neutral: 'var(--viz-muted)' } as const;

function Chip({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[tone] }} aria-hidden />
      <span className="text-[var(--viz-muted)]">{label}</span>
      <b className="tabular-nums">{value}</b>
    </span>
  );
}

/**
 * Home ("Today"): readiness in the header, this week as in Plan, fitness and form, the last 4 weeks, the
 * "Lean and strong" rail (weight, arms, main lifts), and the goals. The deep dives are on /trends.
 */
export default async function HomePage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="performance" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const timeZone = zone((await cookies()).get('tz')?.value);
  const today = todayIn(timeZone);
  const monday = mondayOf(today);
  // Each section loads on its own: a failure shows SectionError for that section and leaves the others.
  const [perf, week, weather, targets, lift, pmc, recovery, body, goals] = await Promise.all([
    load('Performance', () => loadPerformance(userId, today)),
    load('This week', () => loadRange(userId, monday, monday, today)),
    safe('weather', async () => loadForecast(placeFrom(await userSettings(userId)), timeZone), {}),
    safe('targets', () => loadTargets(userId), DEFAULT_TARGETS),
    safe(
      'lift',
      async () => {
        const { model, unit } = await loadLiftModel();
        return {
          thisWeek: muscleSets(model, monday, addDays(monday, 6)),
          top: topLifts(model, unit, addDays(monday, -77)),
          unit,
          hasData: model.sessions.size > 0,
        };
      },
      null
    ),
    load('Fitness and form', () => loadPmc(userId, today)),
    safe('recovery today', () => loadRecoveryToday(userId, today), null),
    safe('body', () => loadBody(userId, today), null),
    load('Goals', async () => measureGoals(sql, userId, await loadGoals(sql, userId), today)),
  ]);

  const r = recovery?.hasData ? recovery : null;
  const load_ = pmc.ok ? pmc.value.days.filter((d) => !d.projected).at(-1) ?? null : null;
  const hrv = hrvStatusLabel(r?.hrvStatus?.value ?? null) as string | null;
  const weeks = perf.ok ? perf.value.weeks : [];
  const last4 = weeks.filter((w) => w.week !== monday).slice(-4);
  const thisWeek = weeks.find((w) => w.week === monday);
  const daysSince = perf.ok && perf.value.latestActivity ? Math.round((Date.parse(today) - Date.parse(perf.value.latestActivity)) / 864e5) : null;
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <div className="space-y-5" data-smoke="performance">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--viz-muted)]">{dateLabel}</p>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        </div>
        <Link href={`/health/day/${today}`} className="flex flex-wrap gap-2" aria-label="Recovery today. Open today's health details.">
          {r?.readiness && <Chip label="Readiness" value={`${Math.round(r.readiness.value)} · ${band(r.readiness.value)}`} tone={r.readiness.value < 25 ? 'bad' : r.readiness.value < 50 ? 'warn' : 'good'} />}
          {r?.sleepMin && <Chip label="Sleep" value={minutes(r.sleepMin.value)} tone={!r.sleepScore ? 'neutral' : r.sleepScore.value < 60 ? 'bad' : r.sleepScore.value < 80 ? 'warn' : 'good'} />}
          {hrv && <Chip label="HRV" value={hrv} tone={hrv === 'Balanced' ? 'good' : hrv === 'Unbalanced' ? 'warn' : 'bad'} />}
          {load_ && <Chip label="Fit / Fat" value={`${Math.round(load_.ctl)} / ${Math.round(load_.atl)}`} tone="neutral" />}
          {load_ && <Chip label="Form" value={signed(load_.tsb)} tone={load_.tsb < -30 ? 'bad' : load_.tsb < -10 ? 'warn' : 'good'} />}
          {!r && !load_ && <span className="text-sm text-[var(--viz-muted)]">No Garmin data today.</span>}
        </Link>
      </div>

      {daysSince !== null && daysSince > 7 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          The newest Strava activity is from {perf.ok && perf.value.latestActivity}.
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {week.ok ? (
            <HomeWeek range={week.value} weather={weather} readiness={r?.readiness ? r.readiness.value : null} />
          ) : (
            <SectionError label="This week" />
          )}
          {pmc.ok ? <PmcSection pmc={pmc.value} ramp={false} /> : <SectionError label="Fitness and form" />}
          {perf.ok && last4.length > 0 && (
            <section className="grid grid-cols-2 gap-y-4 rounded-lg border bg-[var(--viz-surface)] py-4 sm:grid-cols-4" aria-label="Last 4 weeks">
              {[
                ['Time · 4 weeks', `${hm(sum(last4, 'hours'))} h`, `${(sum(last4, 'hours') / 4).toFixed(1)} h a week`, 'var(--viz-ink)'],
                ['Run', `${Math.round(sum(last4, 'runKm'))} km`, pace(sum(last4, 'runMin'), sum(last4, 'runKm')) ?? 'no runs', 'var(--viz-run)'],
                ['Ride', `${Math.round(sum(last4, 'rideKm'))} km`, `${hm(sum(last4, 'rideHours'))} h`, 'var(--viz-ride)'],
                ['Strength', `${sum(last4, 'strength')} of ${targets.strength * 4}`, 'sessions', 'var(--sport-strength)'],
              ].map(([label, value, note, color], i) => (
                <div key={label} className={`min-w-0 px-4 ${i % 2 ? 'border-l' : ''} ${i === 2 ? 'sm:border-l' : ''}`}>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--viz-muted)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                    {label}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)]">{value}</div>
                  <div className="text-xs tabular-nums text-[var(--viz-ink-2)]">{note}</div>
                </div>
              ))}
            </section>
          )}
        </div>
        <LeanStrong body={body} lift={lift} strength={{ done: thisWeek?.strength ?? 0, target: targets.strength }} />
      </div>

      {goals.ok ? <GoalsCard goals={goals.value} /> : <SectionError label="Goals" />}

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="More">
        <Link href="/trends#peaks" className="text-[var(--viz-muted)] hover:text-foreground">Peak performances →</Link>
        <Link href="/trends" className="text-[var(--viz-muted)] hover:text-foreground">Every week and ramp rates →</Link>
        <Link href="/trends#lift" className="text-[var(--viz-muted)] hover:text-foreground">Sets per muscle →</Link>
      </nav>
    </div>
  );
}
