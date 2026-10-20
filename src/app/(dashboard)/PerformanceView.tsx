import Sparkline from '@/components/charts/Sparkline';
import { zoneOf } from '@/lib/performance/form';
import WeeklyHoursChart from '@/components/charts/WeeklyHoursChart';
import type { Performance, WeekStats } from '@/lib/performance/queries';
import { mondayOf } from '@/lib/plan/week.mjs';

const fmtWeek = (w: string) =>
  new Date(`${w}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function pace(min: number, km: number) {
  if (!km) return '-';
  const s = Math.round((min * 60) / km);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
}

const sum = (ws: WeekStats[], key: keyof WeekStats) => ws.reduce((n, w) => n + Number(w[key]), 0);
const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before) return <span className="text-[var(--viz-muted)]">{label}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className="text-[var(--viz-muted)]">
      <span className={up ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]'}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span> vs the 4 weeks before
    </span>
  );
}

/** A stat tile: label, value, a signed change vs a named period, and a 12-week trend. */
function Tile({ label, value, foot, trend }: { label: string; value: string; foot: React.ReactNode; trend: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="text-xs font-medium text-[var(--viz-muted)]">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-[var(--viz-ink)]">{value}</div>
      <div className="mt-1 text-xs">{foot}</div>
      {trend}
    </div>
  );
}

export default function PerformanceView({ perf, today, strengthTarget = 2 }: { perf: Performance; today: string; strengthTarget?: number }) {
  const weeks = perf.weeks;
  const currentWeek = mondayOf(today);
  // Compare complete weeks: the last 4 before this one, against the 4 before those.
  const complete = weeks.filter((w) => w.week !== currentWeek);
  const last4 = complete.slice(-4);
  const prev4 = complete.slice(-8, -4);
  const labels = weeks.map((w) => `Week of ${fmtWeek(w.week)}`);
  const daysSince = perf.latestActivity ? Math.round((Date.parse(today) - Date.parse(perf.latestActivity)) / 864e5) : null;
  const lastLoad = perf.load.at(-1);
  const weeklyLoad = perf.load.filter((_, i) => i % 7 === 6 || i === perf.load.length - 1);

  return (
    <div className="space-y-6">
      {daysSince !== null && daysSince > 7 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          The newest Strava activity is from {perf.latestActivity}.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="Hours, last 4 weeks"
          value={hm(sum(last4, 'hours'))}
          foot={<Delta now={sum(last4, 'hours')} before={sum(prev4, 'hours')} label="Moving time" />}
          trend={<Sparkline values={weeks.map((w) => w.hours)} labels={labels} display={weeks.map((w) => `${hm(w.hours)} h`)} />}
        />
        <Tile
          label="Run, last 4 weeks"
          value={`${Math.round(sum(last4, 'runKm'))} km`}
          foot={<span className="text-[var(--viz-muted)]">Pace {pace(sum(last4, 'runMin'), sum(last4, 'runKm'))}</span>}
          trend={<Sparkline values={weeks.map((w) => w.runKm)} labels={labels} display={weeks.map((w) => `${w.runKm.toFixed(1)} km`)} accent="var(--viz-run)" />}
        />
        <Tile
          label="Ride, last 4 weeks"
          value={`${hm(sum(last4, 'rideHours'))} h`}
          foot={<Delta now={sum(last4, 'rideHours')} before={sum(prev4, 'rideHours')} label="Moving time" />}
          trend={<Sparkline values={weeks.map((w) => w.rideHours)} labels={labels} display={weeks.map((w) => `${hm(w.rideHours)} h`)} accent="var(--viz-ride)" />}
        />
        <Tile
          label="Form today"
          value={lastLoad ? `${lastLoad.tsb > 0 ? '+' : ''}${Math.round(lastLoad.tsb)}` : '-'}
          foot={
            <span className="text-[var(--viz-muted)]">
              {lastLoad ? `${zoneOf(lastLoad.tsb)} · fitness ${Math.round(lastLoad.ctl)}` : 'No load data'} · strength {sum(last4, 'strength')}/{strengthTarget * 4}
            </span>
          }
          trend={<Sparkline values={weeklyLoad.map((p) => p.ctl)} labels={weeklyLoad.map((p) => p.date)} display={weeklyLoad.map((p) => `fitness ${Math.round(p.ctl)}`)} />}
        />
      </div>

      <WeeklyHoursChart
        currentWeek={currentWeek}
        weeks={weeks.map((w) => ({ week: w.week, sports: w.sports, strength: w.strength, tss: w.tss }))}
      />

      <details className="rounded-lg border bg-[var(--viz-surface)]">
        <summary className="cursor-pointer select-none p-3 text-sm font-medium">Table: every week</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-muted/50 text-left text-xs text-[var(--viz-muted)]">
              <tr>
                <th className="p-2">Week</th>
                <th className="p-2 text-right">Hours</th>
                <th className="p-2 text-right">Run km</th>
                <th className="p-2 text-right">Run pace</th>
                <th className="p-2 text-right">Ride km</th>
                <th className="p-2 text-right">Strength</th>
                <th className="p-2 text-right">TSS</th>
                <th className="p-2 text-right">Plan done</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.week} className="border-t">
                  <td className="p-2">{fmtWeek(w.week)}{w.week === currentWeek ? ' (this week)' : ''}</td>
                  <td className="p-2 text-right">{hm(w.hours)}</td>
                  <td className="p-2 text-right">{w.runKm ? w.runKm.toFixed(1) : '-'}</td>
                  <td className="p-2 text-right">{pace(w.runMin, w.runKm)}</td>
                  <td className="p-2 text-right">{w.rideKm ? w.rideKm.toFixed(0) : '-'}</td>
                  <td className="p-2 text-right">{w.strength || '-'}</td>
                  <td className="p-2 text-right">{w.tss ? Math.round(w.tss) : '-'}</td>
                  <td className="p-2 text-right">{w.planned ? `${w.done}/${w.planned}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
