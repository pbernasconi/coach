import { RUN_DISTANCES } from '@/lib/performance/peaks.mjs';
import { peakText, shortDateYear as fmtDate } from '@/lib/performance/display.mjs';
import type { PeakCell, PeakPerformances as Peaks, PeakRow } from '@/lib/performance/peaks';

const meters = new Map(RUN_DISTANCES.map((d: { span: number; meters: number }) => [d.span, d.meters]));

function Cell({ cell, render, best }: { cell: PeakCell; render: (v: number) => { main: string; sub: string | null }; best: boolean }) {
  if (!cell) return <td className="p-2 text-right text-[var(--viz-muted)]">–</td>;
  const { main, sub } = render(cell.value);
  return (
    <td className="p-2 text-right align-top">
      <a
        href={`/activities/${cell.activityId}`}
        title={`${cell.name ?? 'Activity'} · ${fmtDate(cell.date)}`}
        className="group inline-block"
      >
        <span className={`tabular-nums text-[var(--viz-ink)] group-hover:underline ${best ? 'font-semibold' : ''}`}>{main}</span>
        {sub && <span className="ml-1 text-[11px] tabular-nums text-[var(--viz-ink-2)]">{sub}</span>}
        <span className="block text-[10px] text-[var(--viz-muted)]">{fmtDate(cell.date)}</span>
      </a>
    </td>
  );
}

function Table({ title, unit, rows, windows, render }: {
  title: string;
  unit: string;
  rows: PeakRow[];
  windows: Peaks['windows'];
  render: (row: PeakRow) => (v: number) => { main: string; sub: string | null };
}) {
  const empty = rows.every((r) => !r.cells.all);
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-sm font-semibold text-[var(--viz-ink)]">{title} <span className="font-normal text-[var(--viz-muted)]">{unit}</span></h3>
      {empty ? (
        <p className="py-4 text-sm text-[var(--viz-muted)]">No data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--viz-muted)]">
              <tr>
                <th className="p-2 text-left font-medium" scope="col"><span className="sr-only">Span</span></th>
                {windows.map((w) => <th key={w.key} scope="col" className="p-2 text-right font-medium">{w.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.span} className="border-t">
                  <th scope="row" className="p-2 text-left align-top font-medium text-[var(--viz-ink-2)]">{r.label}</th>
                  {windows.map((w) => (
                    <Cell
                      key={w.key}
                      cell={r.cells[w.key]}
                      render={render(r)}
                      // Bold where the window's best equals the all-time best.
                      best={!!r.cells[w.key] && r.cells[w.key]?.activityId === r.cells.all?.activityId}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Peak performances, TrainingPeaks style: best average power over 5 s to 60 min (rides with a power meter) and
 * fastest times over 1 km to a half marathon (runs), all time and in the last 90 and 28 days.
 * Bold: the all-time best. Each value links to its Strava activity.
 */
export default function PeakPerformances({ peaks }: { peaks: Peaks }) {
  return (
    <section className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3">
        <h2 className="font-semibold text-[var(--viz-ink)]">Peak performances</h2>
        <p className="text-xs text-[var(--viz-muted)]">
          From Strava streams. Elapsed time for runs, so stops count.
          {peaks.pending > 0 && ` ${peaks.pending} activities still to scan.`}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Table
          title="Power"
          unit="best average, W"
          rows={peaks.power}
          windows={peaks.windows}
          render={(row) => (v) => peakText('power', row.span, v)}
        />
        <Table
          title="Run"
          unit="fastest time · pace /km"
          rows={peaks.run}
          windows={peaks.windows}
          render={(row) => (v) => peakText('run', meters.get(row.span) ?? row.span, v)}
        />
      </div>
    </section>
  );
}
