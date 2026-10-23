import { Info } from 'lucide-react';
import { HelpTooltip } from '@kobo/web';
import { MUSCLE_BAND, bandStatus, muscleGroups } from '@/lib/lift-dashboard/text.mjs';
import { fmtSets, muscleName, type MuscleRow } from './types';

const MIN = MUSCLE_BAND.min;
const MAX = MUSCLE_BAND.max;

/**
 * Hard sets per muscle: this week as a bar, the average of the 4 weeks before as a tick, the 10-20 growth band
 * shaded. Arms first (the goal of the block). A set counts 1 for a primary muscle and 0.5 for a secondary one.
 */
export default function MuscleBars({ rows }: { rows: MuscleRow[] }) {
  const top = Math.max(24, ...rows.map((r) => Math.max(r.week, r.avg)));
  const pct = (v: number) => `${(Math.min(v, top) / top) * 100}%`;
  const { arms, rest } = muscleGroups(rows);
  const status = bandStatus;
  const Row = ({ r }: { r: MuscleRow }) => {
    const s = status(r.avg);
    return (
      <div
        className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 py-1 text-xs sm:grid-cols-[7rem_minmax(0,1fr)_6rem]"
        role="img"
        aria-label={`${muscleName(r.muscle)}: ${fmtSets(r.week)} sets this week, ${fmtSets(r.avg)} a week on average, ${s === 'in' ? 'in' : s} the 10 to 20 range`}
      >
        <span className={`truncate ${r.arm ? 'font-semibold' : ''} text-[var(--viz-ink)]`}>{muscleName(r.muscle)}</span>
        <div className="relative h-3.5">
          <div className="absolute inset-y-0 rounded-sm bg-[color-mix(in_oklab,var(--viz-good)_14%,transparent)]" style={{ left: pct(MIN), width: `calc(${pct(MAX)} - ${pct(MIN)})` }} />
          <div className="absolute inset-y-[3px] left-0 rounded-r-[4px]" style={{ width: pct(r.week), background: 'var(--sport-strength)' }} />
          <div className="absolute -inset-y-0.5 w-[3px] -translate-x-1/2 rounded-full bg-[var(--viz-ink)]" style={{ left: pct(r.avg) }} />
        </div>
        <span className="whitespace-nowrap text-right tabular-nums text-[var(--viz-ink-2)]">
          <b className="font-semibold text-[var(--viz-ink)]">{fmtSets(r.week)}</b> · {fmtSets(r.avg)}
          <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${s === 'in' ? 'bg-[var(--viz-good)]' : s === 'above' ? 'bg-[var(--color-amber-500)]' : 'bg-[var(--viz-axis)]'}`} aria-hidden />
        </span>
      </div>
    );
  };
  return (
    <section id="muscles" className="scroll-mt-20 rounded-xl border bg-card" aria-labelledby="muscles-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="muscles-h" className="inline-flex items-center gap-1.5 font-semibold">
          Hard sets per muscle
          <HelpTooltip label="About hard sets per muscle" icon={<Info aria-hidden />}>
            Done working sets this week. 10–20 a week grows a muscle. A primary muscle counts 1 set, a secondary ½.
          </HelpTooltip>
        </h2>
        <div className="flex flex-wrap gap-3 text-[11px] text-[var(--viz-ink-2)]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: 'var(--sport-strength)' }} />This week</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-[3px] rounded-full bg-[var(--viz-ink)]" />4-week average</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[color-mix(in_oklab,var(--viz-good)_25%,transparent)]" />10–20</span>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">Arms · the goal</p>
          {arms.map((r) => <Row key={r.muscle} r={r} />)}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">Everything else</p>
          {rest.map((r) => <Row key={r.muscle} r={r} />)}
        </div>
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] gap-3 text-[10px] text-[var(--viz-muted)] sm:grid-cols-[7rem_minmax(0,1fr)_6rem]">
          <span />
          <div className="relative h-3">
            {[0, MIN, MAX].map((t) => (
              <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(t) }}>{t}</span>
            ))}
          </div>
          <span className="text-right">week · avg</span>
        </div>
      </div>
    </section>
  );
}
