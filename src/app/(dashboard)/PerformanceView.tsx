import { StatCard } from '@/components/stat-card';
import type { LoadPoint, Performance, WeekStats } from '@/lib/performance/queries';

const fmtWeek = (w: string) =>
  new Date(`${w}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function pace(min: number, km: number) {
  if (!km) return '-';
  const s = Math.round((min * 60) / km);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
}

function sum(ws: WeekStats[], key: keyof WeekStats) {
  return ws.reduce((n, w) => n + Number(w[key]), 0);
}

function change(now: number, before: number) {
  if (!before) return undefined;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs the 4 weeks before`;
}

/** Stacked weekly bars: run hours, ride hours and other hours, with the strength count on top. */
function WeeklyBars({ weeks }: { weeks: WeekStats[] }) {
  const max = Math.max(4, ...weeks.map((w) => w.hours));
  const H = 160;
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Hours per week</h2>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-orange-500" /> run</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-sky-500" /> ride</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-zinc-400" /> other</span>
          <span>🏋️ strength sessions</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: H + 36 }}>
        {weeks.map((w) => {
          const run = w.runMin / 60;
          const other = Math.max(0, w.hours - run - w.rideHours);
          const px = (h: number) => `${(h / max) * H}px`;
          return (
            <div key={w.week} className="flex flex-1 flex-col items-center gap-1" title={`${fmtWeek(w.week)}: ${w.hours.toFixed(1)} h, run ${w.runKm.toFixed(0)} km, ride ${w.rideHours.toFixed(1)} h, strength ${w.strength}`}>
              <span className="text-[10px] text-muted-foreground">{w.strength ? `🏋️${w.strength}` : ''}</span>
              <div className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-sm">
                <div className="bg-orange-500" style={{ height: px(run) }} />
                <div className="bg-sky-500" style={{ height: px(w.rideHours) }} />
                <div className="bg-zinc-400" style={{ height: px(other) }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{fmtWeek(w.week)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** CTL (fitness), ATL (fatigue) and TSB (form) as lines. */
function LoadChart({ load }: { load: LoadPoint[] }) {
  if (load.length < 2) return null;
  const W = 600;
  const H = 160;
  const vals = load.flatMap((p) => [p.ctl, p.atl, p.tsb]);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (i / (load.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H;
  const line = (k: 'ctl' | 'atl' | 'tsb') => load.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const last = load[load.length - 1];
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Fitness, fatigue and form</h2>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="text-sky-600">Fitness (CTL) {Math.round(last.ctl)}</span>
          <span className="text-rose-500">Fatigue (ATL) {Math.round(last.atl)}</span>
          <span className="text-emerald-600">Form (TSB) {last.tsb > 0 ? '+' : ''}{Math.round(last.tsb)}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Training load">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeDasharray="4 4" />
        <path d={line('ctl')} fill="none" className="stroke-sky-600" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={line('atl')} fill="none" className="stroke-rose-500" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={line('tsb')} fill="none" className="stroke-emerald-600" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">{load[0].date} to {last.date}. Estimated from Strava (power, heart rate or duration).</p>
    </div>
  );
}

export default function PerformanceView({ perf, today }: { perf: Performance; today: string }) {
  const weeks = perf.weeks;
  const last4 = weeks.slice(-4);
  const prev4 = weeks.slice(-8, -4);
  const daysSince = perf.latestActivity ? Math.round((Date.parse(today) - Date.parse(perf.latestActivity)) / 864e5) : null;
  return (
    <div className="space-y-6">
      {daysSince !== null && daysSince > 7 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          The newest Strava activity here is from {perf.latestActivity}. Strava syncs again after the Strava app secret is set up.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Hours, last 4 weeks" value={sum(last4, 'hours').toFixed(1)} subtitle={change(sum(last4, 'hours'), sum(prev4, 'hours'))} />
        <StatCard title="Run km, last 4 weeks" value={sum(last4, 'runKm').toFixed(0)} subtitle={`Pace ${pace(sum(last4, 'runMin'), sum(last4, 'runKm'))}`} />
        <StatCard title="Ride hours, last 4 weeks" value={sum(last4, 'rideHours').toFixed(1)} subtitle={change(sum(last4, 'rideHours'), sum(prev4, 'rideHours'))} />
        <StatCard title="Strength, last 4 weeks" value={String(sum(last4, 'strength'))} subtitle="Target: 8 (2 a week)" />
      </div>
      <WeeklyBars weeks={weeks} />
      <LoadChart load={perf.load} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
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
                <td className="p-2">{fmtWeek(w.week)}</td>
                <td className="p-2 text-right">{w.hours.toFixed(1)}</td>
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
    </div>
  );
}
