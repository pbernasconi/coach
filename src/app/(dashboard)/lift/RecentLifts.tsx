import Link from 'next/link';
import { ChevronRight, Clock, Trophy } from 'lucide-react';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import type { RichSession } from '@/lib/lift/session';
import { epleyOf } from './epley';
import { fmtDay, muscleName } from './types';

const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function clock(iso: string | null, tz: string) {
  return iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }) : null;
}

/** Sets done out of planned, as a small ring. */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center" role="img" aria-label={`${done} of ${total} sets done`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--viz-grid)" strokeWidth="5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={pct >= 1 ? 'var(--viz-good)' : 'var(--sport-strength)'} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums text-[var(--viz-ink)]">{Math.round(pct * 100)}%</span>
    </div>
  );
}

type Set = RichSession['exercises'][number]['sets'][number];

function SetChip({ s }: { s: Set }) {
  const load = s.weight === null ? 'BW' : n(Math.round(s.weight * 10) / 10);
  const reps = s.reps ?? s.target.reps ?? s.target.repMin ?? '–';
  const text = `${load}×${reps}`;
  if (s.kind === 'warmUp') {
    return <span className="rounded-md bg-[var(--viz-band)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--viz-muted)]" title="Warm-up">W {text}</span>;
  }
  if (s.status === 'done') {
    return <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white" style={{ background: 'var(--sport-strength)' }}>{text}</span>;
  }
  if (s.status === 'skipped') {
    return <span className="rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--viz-muted)] line-through" title="Skipped">{text}</span>;
  }
  return <span className="rounded-md border border-dashed border-[var(--sport-strength)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--viz-ink-2)]" title="Not logged">{text}</span>;
}

/**
 * The last few sessions in full: when, how long, how much of the plan was done, the note, and every exercise with
 * its picture, its sets (weight × reps; filled = logged, dashed = not logged, struck = skipped) and its top set
 * against the session before. Each card opens the session page.
 */
export default function RecentLifts({ sessions, prs, tz }: { sessions: RichSession[]; prs: Map<string, string[]>; tz: string }) {
  if (sessions.length === 0) return null;
  return (
    <section id="recent" className="scroll-mt-20 space-y-3" aria-labelledby="recent-h">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="recent-h" className="font-semibold">Recent lifts</h2>
        <a href="#sessions" className="text-xs text-[var(--viz-muted)] hover:text-foreground">All sessions ↓</a>
      </div>
      {sessions.map((d) => {
        const start = clock(d.startedAt, tz);
        const records = prs.get(d.id) ?? [];
        return (
          <article key={d.id} className="overflow-hidden rounded-xl border bg-card">
            <Link href={`/lift/sessions/${d.id}`} className="group flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-[var(--viz-band)]">
              <Ring done={d.setsLogged} total={d.setsTotal} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-[var(--viz-ink)] group-hover:underline">{d.title || 'Lift session'}</span>
                  {records.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-amber-500)_18%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-amber-600)] dark:text-[var(--color-amber-400)]" title={records.join(', ')}>
                      <Trophy aria-hidden className="h-3 w-3" /> {records.length} {records.length === 1 ? 'record' : 'records'}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--viz-ink-2)]">
                  <span>{fmtDay(d.day, { weekday: 'short', month: 'short', day: 'numeric' })}{start ? ` · ${start}` : ''}</span>
                  {d.minutes !== null && <span className="inline-flex items-center gap-1"><Clock aria-hidden className="h-3 w-3" />{d.minutes} min</span>}
                  <span>{d.setsLogged} of {d.setsTotal} sets</span>
                  {d.volume > 0 && <span className="tabular-nums">{Math.round(d.volume).toLocaleString('en-US')} {d.unit}</span>}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-[var(--viz-muted)] transition-transform group-hover:translate-x-0.5" />
            </Link>
            {d.note && <p className="border-b bg-[var(--viz-band)] px-4 py-2 text-xs italic text-[var(--viz-ink-2)]">“{d.note}”</p>}
            <ul className="grid xl:grid-cols-2">
              {d.exercises.map((e, i) => {
                const top = e.sets.filter((s) => s.status === 'done' && s.kind !== 'warmUp').reduce<number | null>((m, s) => {
                  const v = epleyOf(s.reps, s.weight);
                  return v !== null && (m === null || v > m) ? v : m;
                }, null);
                const prev = e.history.trend.at(-1)?.e1rm ?? null;
                const delta = top !== null && prev !== null ? top - prev : null;
                const working = e.sets.filter((s) => s.kind !== 'warmUp');
                const done = working.filter((s) => s.status === 'done').length;
                return (
                  <li key={e.id} className={`flex gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''} ${i === 1 ? 'xl:border-t-0' : ''} ${i % 2 ? 'xl:border-l' : ''}`}>
                    <ExerciseThumb image={e.media?.image} gif={e.media?.gif} name={e.name} size="sm" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="truncate text-sm font-medium text-[var(--viz-ink)] hover:underline">{e.name}</Link>
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--viz-muted)]">{done}/{working.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {e.sets.map((s) => <SetChip key={s.id} s={s} />)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--viz-ink-2)]">
                        {e.primary.length > 0 && <span>{e.primary.map(muscleName).join(', ')}</span>}
                        {top !== null && <span className="tabular-nums">e1RM {Math.round(top)}</span>}
                        {delta !== null && (
                          <span className={`tabular-nums ${delta > 0.5 ? 'text-[var(--viz-up)]' : delta < -0.5 ? 'text-[var(--viz-down)]' : 'text-[var(--viz-muted)]'}`}>
                            {delta > 0.5 ? `▲ ${Math.round(delta)}` : delta < -0.5 ? `▼ ${Math.round(-delta)}` : '='} vs last
                          </span>
                        )}
                      </div>
                      {e.note && <p className="text-[11px] italic text-[var(--viz-muted)]">{e.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
