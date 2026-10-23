import Sparkline from '@/components/charts/Sparkline';
import WeeklyHoursChart from '@/components/charts/WeeklyHoursChart';
import type { Performance } from '@/lib/performance/queries';
import { performanceTiles, staleText, weekRow } from '@/lib/performance/display.mjs';
import { mondayOf } from '@/lib/plan/week.mjs';

const ACCENT: Record<string, string> = { run: 'var(--viz-run)', ride: 'var(--viz-ride)' };

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
  // Complete weeks: the last 4 before this one, against the 4 before those (performanceTiles in display.mjs).
  const tiles = performanceTiles(perf, currentWeek, strengthTarget);
  const stale = staleText(perf.latestActivity, today);

  return (
    <div className="space-y-6">
      {stale && <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">{stale}</div>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            label={t.label}
            value={t.valueText}
            foot={
              t.delta ? (
                <span className="text-[var(--viz-muted)]">
                  <span className={t.delta.flat ? 'text-[var(--viz-ink-2)]' : t.delta.up ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]'}>{t.delta.text}</span> vs the 4 weeks before
                </span>
              ) : (
                <span className="text-[var(--viz-muted)]">{t.foot}</span>
              )
            }
            trend={<Sparkline values={t.spark.values} labels={t.spark.labels} display={t.spark.texts} accent={t.sport ? ACCENT[t.sport] : undefined} />}
          />
        ))}
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
              {[...weeks].reverse().map((w) => weekRow(w, currentWeek)).map((w) => (
                <tr key={w.week} className="border-t">
                  <td className="p-2">{w.label}</td>
                  <td className="p-2 text-right">{w.hoursText}</td>
                  <td className="p-2 text-right">{w.runKmText}</td>
                  <td className="p-2 text-right">{w.runPaceText}</td>
                  <td className="p-2 text-right">{w.rideKmText}</td>
                  <td className="p-2 text-right">{w.strengthText}</td>
                  <td className="p-2 text-right">{w.tssText}</td>
                  <td className="p-2 text-right">{w.planText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
