import Link from 'next/link';
import { cookies } from 'next/headers';
import SectionError from '@/components/SectionError';
import MiniTrend from '@/components/vitals/MiniTrend';
import TrainingStatusCard from '@/components/vitals/TrainingStatusCard';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { todayIn } from '@/lib/plan/week.mjs';
import { addDays } from '@/lib/vitals/readiness.mjs';
import { fmtPace, fmtTime } from '@/lib/vitals/garmin-training.mjs';
import { loadTraining, type Pt, type TrainingView } from '@/lib/vitals/garmin-pages';
import HealthTrendChart from '../HealthTrendChart';

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

const signed = (n: number, f: (v: number) => string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${f(Math.abs(n))}`;

/** A tile: the newest value, its change over 4 weeks, and a trend. `better` says which way is an improvement. */
function TrendTile({ label, points, format, unit, better }: { label: string; points: Pt[]; format: (v: number) => string; unit?: string; better: 'up' | 'down' }) {
  const last = points.at(-1);
  const before = last ? [...points].reverse().find((p) => Date.parse(p.date) <= Date.parse(last.date) - 28 * 864e5) : undefined;
  const change = last && before ? last.value - before.value : null;
  const good = change === null || change === 0 ? null : (change > 0) === (better === 'up');
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="text-xs font-medium text-[var(--viz-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)]">
        {last ? format(last.value) : '-'}
        {last && unit && <span className="ml-1 text-sm font-normal text-[var(--viz-muted)]">{unit}</span>}
      </div>
      <div className="mt-1 text-xs text-[var(--viz-muted)]">
        {!last ? 'No data yet' : change === null ? `as of ${last.date}` : (
          <>
            <span className={good === null ? '' : good ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]'}>
              {signed(change, format)} {good === null ? '' : good ? '(better)' : '(worse)'}
            </span>{' '}
            in 4 weeks
          </>
        )}
      </div>
      <MiniTrend points={points} display={points.map((p) => format(p.value))} />
    </div>
  );
}

export default async function TrainingPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health-training" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const training = await load('Training', () => loadTraining(userId, today));
  return (
    <div className="space-y-6" data-smoke="health-training">
      <div className="space-y-1">
        <Link href="/health" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Health</Link>
        <h1 className="text-3xl font-bold tracking-tight">Training</h1>
        <p className="text-muted-foreground">Garmin&apos;s performance view: status, load, scores, race predictions, thresholds and records.</p>
      </div>
      {training.ok ? <TrainingBody t={training.value} today={today} /> : <SectionError label="Training" />}
    </div>
  );
}

function TrainingBody({ t, today }: { t: TrainingView; today: string }) {
  const from = addDays(today, -364);
  const hasAny =
    t.status || t.statusFallback || t.endurance.series.length || t.hill.series.length || t.races.some((r) => r.series.length) ||
    Object.values(t.tiles).some((s) => s.length) || t.records.length;
  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No Garmin performance data yet.</p>
        <p className="mt-1">
          The Garmin job copies training status, load, endurance and hill scores, race predictions, lactate threshold, FTP, VO2max and personal
          records from Garmin Connect. They appear here after its next run. Some need weeks of runs or rides with heart rate on the watch.
        </p>
      </div>
    );
  }
  const r0 = (v: number) => String(Math.round(v));
  return (
    <>
      <TrainingStatusCard t={t} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Scores</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <HealthTrendChart
            title="Endurance score"
            subtitle={t.endurance.latest?.classification ? `${t.endurance.latest.classification}. Garmin's measure of how long you can hold an effort.` : "Garmin's measure of how long you can hold an effort."}
            points={t.endurance.series}
            from={from}
            to={today}
            unit="points"
          />
          <HealthTrendChart
            title="Hill score"
            subtitle={t.hill.latest ? `Strength ${t.hill.latest.strength ?? '-'} · endurance ${t.hill.latest.endurance ?? '-'} (of 100).` : 'Climbing strength and endurance, of 100.'}
            points={t.hill.series}
            from={from}
            to={today}
            unit="points"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Race predictions</h2>
        <div className="overflow-hidden rounded-lg border bg-[var(--viz-surface)]">
          <ul className="divide-y">
            {t.races.map((r) => {
              const c = r.latest?.change ?? null;
              return (
                <li key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_7rem_1fr_12rem]">
                  <span className="text-sm font-medium text-[var(--viz-ink)]">{r.label}</span>
                  <span className="text-right text-lg font-semibold tabular-nums text-[var(--viz-ink)] sm:text-left">{r.latest ? fmtTime(r.latest.value) : '-'}</span>
                  <div className="col-span-2 sm:col-span-1">
                    <MiniTrend points={r.series} display={r.series.map((p) => fmtTime(p.value))} height={28} />
                  </div>
                  <span className="col-span-2 text-xs text-[var(--viz-ink-2)] sm:col-span-1 sm:text-right">
                    {c === null || !r.latest?.since ? (r.latest ? `as of ${r.latest.date}` : 'No prediction') : c === 0 ? `no change since ${r.latest.since}` : (
                      <span className={c < 0 ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]'}>
                        {fmtTime(Math.abs(c))} {c < 0 ? 'faster' : 'slower'} since {r.latest.since}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Thresholds and fitness</h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <TrendTile label="Lactate threshold HR" points={t.tiles.ltHr} format={r0} unit="bpm" better="up" />
          <TrendTile label="Lactate threshold pace" points={t.tiles.ltPace} format={(v) => fmtPace(v)} better="down" />
          <TrendTile label="Cycling FTP" points={t.tiles.ftp} format={r0} unit="W" better="up" />
          <TrendTile label={t.tiles.vo2maxCycling.length ? 'VO2max (running)' : 'VO2max'} points={t.tiles.vo2max} format={(v) => v.toFixed(1)} unit="mL/kg/min" better="up" />
          {t.tiles.vo2maxCycling.length > 0 && (
            <TrendTile label="VO2max (cycling)" points={t.tiles.vo2maxCycling} format={(v) => v.toFixed(1)} unit="mL/kg/min" better="up" />
          )}
          <TrendTile label="Fitness age" points={t.tiles.fitnessAge} format={(v) => v.toFixed(0)} unit="years" better="down" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Personal records</h2>
          {t.recordsDate && <span className="text-xs text-muted-foreground">from Garmin, {t.recordsDate}</span>}
        </div>
        {t.records.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No personal records from Garmin yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {t.records.map((p) => (
              <li key={p.key} className="min-w-0 rounded-lg border bg-[var(--viz-surface)] px-3 py-3 sm:px-4">
                <div className="text-xs text-[var(--viz-muted)]">{p.label}</div>
                <div className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{p.value}</div>
                <div className="truncate text-[11px] text-[var(--viz-ink-2)]">{[p.date, p.activity].filter(Boolean).join(' · ') || ' '}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
