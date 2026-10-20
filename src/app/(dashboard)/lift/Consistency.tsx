import Link from 'next/link';
import { fmtDay, type Overview } from './types';

const ROWS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

function shade(sets: number) {
  if (!sets) return undefined;
  const mix = sets >= 20 ? 100 : sets >= 14 ? 80 : sets >= 8 ? 60 : 40;
  return `color-mix(in oklab, var(--sport-strength) ${mix}%, transparent)`;
}

/** The last 16 weeks as a day grid (a lifted day is coloured by its sets) and sessions per week against the target. */
export default function Consistency({ o }: { o: Overview }) {
  const maxSessions = Math.max(o.strengthTarget + 1, ...o.weeks.map((w) => w.sessions));
  return (
    <section id="consistency" className="scroll-mt-20 rounded-xl border bg-card" aria-labelledby="consistency-h">
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 id="consistency-h" className="font-semibold">Consistency</h2>
        <span className="text-xs text-[var(--viz-muted)]">16 weeks</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [`${o.hits}/8`, 'weeks at target'],
            [o.avg8.toFixed(1), 'a week, 8 wks'],
            [String(o.totals.sessions), 'sessions logged'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg bg-[var(--viz-band)] px-2 py-2">
              <div className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{v}</div>
              <div className="text-[10px] text-[var(--viz-muted)]">{l}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] pt-4 text-[9px] leading-none text-[var(--viz-muted)]">
            {ROWS.map((r, i) => <span key={i} className="flex h-3 items-center">{r}</span>)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="grid h-4 text-[9px] text-[var(--viz-muted)]" style={{ gridTemplateColumns: `repeat(${o.calendar.length}, minmax(0, 1fr))` }}>
              {o.calendar.map((w, i) => {
                const first = w[0].day;
                const show = i === 0 || first.slice(5, 7) !== o.calendar[i - 1][0].day.slice(5, 7);
                return <span key={first} className="overflow-visible whitespace-nowrap">{show ? fmtDay(first, { month: 'short' }) : ''}</span>;
              })}
            </div>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${o.calendar.length}, minmax(0, 1fr))` }}>
              {o.calendar.map((w) => (
                <div key={w[0].day} className="grid grid-rows-7 gap-[3px]">
                  {w.map((d) => {
                    const title = d.sets ? `${fmtDay(d.day, { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.title}, ${d.sets} sets` : fmtDay(d.day, { weekday: 'short', month: 'short', day: 'numeric' });
                    const cls = `block h-3 rounded-[3px] ${d.future ? 'opacity-30' : ''} ${d.day === o.today ? 'ring-1 ring-[var(--viz-ink)]' : ''}`;
                    return d.sessionId ? (
                      <Link key={d.day} href={`/lift/sessions/${d.sessionId}`} title={title} aria-label={title} className={`${cls} hover:ring-1 hover:ring-[var(--viz-ink)]`} style={{ background: shade(d.sets) }} />
                    ) : (
                      <span key={d.day} title={title} className={`${cls} bg-[var(--viz-band)]`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1 flex justify-between text-[10px] text-[var(--viz-muted)]">
            <span>Sessions a week</span>
            <span>line = target {o.strengthTarget}</span>
          </p>
          <div className="relative flex h-14 items-end gap-[3px]">
            <div className="absolute inset-x-0 border-t border-dashed border-[var(--viz-axis)]" style={{ bottom: `${(o.strengthTarget / maxSessions) * 100}%` }} />
            {o.weeks.map((w) => (
              <div
                key={w.week}
                className="flex-1 rounded-t-[2px]"
                title={`Week of ${fmtDay(w.week)}: ${w.sessions} sessions, ${w.sets} sets`}
                style={{
                  height: w.sessions ? `${(w.sessions / maxSessions) * 100}%` : '2px',
                  background: w.sessions >= o.strengthTarget ? 'var(--sport-strength)' : w.sessions ? 'color-mix(in oklab, var(--sport-strength) 45%, transparent)' : 'var(--viz-grid)',
                }}
              />
            ))}
          </div>
        </div>
        <Link href="/lift/weekly" className="block text-xs text-[var(--viz-muted)] hover:text-foreground">Every week, sets and volume →</Link>
      </div>
    </section>
  );
}
