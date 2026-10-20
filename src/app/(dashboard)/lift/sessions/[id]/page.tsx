import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import SectionError from '@/components/SectionError';
import LinkHotkeys from '@/components/hotkeys/LinkHotkeys';
import ExerciseCard from '@/components/lift/ExerciseCard';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { muscleLabel, num } from '@/components/lift/format';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { formatDay } from '@/lib/lift-dashboard/format';
import { plannedVolume, richSession, sessionMuscles, sessionState, type RichSession } from '@/lib/lift/session';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { load } from '@/lib/safe';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATE = {
  planned: { label: 'Planned', className: 'border bg-background text-[var(--viz-ink-2)]' },
  inProgress: { label: 'In progress', className: 'bg-[color-mix(in_oklab,var(--plan-partial,#b98000)_15%,transparent)] text-[#8f5f00] dark:text-[#ffc21a]' },
  done: { label: 'Done', className: 'bg-[color-mix(in_oklab,var(--viz-good)_15%,transparent)] text-[var(--viz-up)]' },
} as const;

function clock(iso: string | null, tz: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
}

function duration(minutes: number | null) {
  if (minutes === null) return '–';
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}

/**
 * One Lift session: what it is (template, day, state), how far along it is, the muscles it works, and each exercise
 * with its picture, its sets (target and logged) and its history. /lift/sessions/<session id>, or
 * /lift/sessions/latest for the newest logged session (the deploy check renders that one).
 */
export default async function LiftSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).slice(0, 64);
  const loaded = await load('Lift session', async () => {
    const { model, unit } = await loadLiftModel();
    return richSession(model, id, unit);
  });
  if (!loaded.ok) {
    return (
      <div data-smoke="lift-session" className="space-y-4">
        <BackLink />
        <SectionError label="Lift session" />
      </div>
    );
  }
  const d = loaded.value;
  if (!d) {
    if (id !== 'latest') notFound();
    return (
      <div data-smoke="lift-session" className="space-y-2">
        <BackLink />
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No sessions yet. Sessions appear here after the Lift app syncs.
        </p>
      </div>
    );
  }

  const tz = await cookieTimeZone();
  return (
    <div data-smoke="lift-session" className="space-y-6">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <BackLink />
        <div className="flex items-center gap-1">
          {d.olderId ? (
            <Link href={`/lift/sessions/${d.olderId}`} className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-accent" aria-label="Older session">
              <ChevronLeft className="h-4 w-4" /> Older
            </Link>
          ) : null}
          {d.newerId ? (
            <Link href={`/lift/sessions/${d.newerId}`} className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-accent" aria-label="Newer session">
              Newer <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </nav>

      <LinkHotkeys
        links={[
          { key: '[', label: 'Older session', href: d.olderId && `/lift/sessions/${d.olderId}` },
          { key: ']', label: 'Newer session', href: d.newerId && `/lift/sessions/${d.newerId}` },
          { key: 'b', label: 'Back to Lift', href: '/lift' },
        ]}
      />
      <Hero d={d} start={clock(d.startedAt, tz)} />

      {d.exercises.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This session has no exercises.</p>
      ) : (
        <div className="space-y-4">
          {d.exercises.map((e, i) => (
            <ExerciseCard key={e.id} e={e} unit={d.unit} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Hero({ d, start }: { d: RichSession; start: string | null }) {
  const state = STATE[sessionState(d)];
  const pct = d.setsTotal ? d.setsLogged / d.setsTotal : 0;
  const muscles = sessionMuscles(d).slice(0, 8);
  const most = muscles[0]?.sets ?? 1;
  const planned = plannedVolume(d);
  const stats: [string, string, string?][] = [
    ['Exercises', String(d.exercises.length)],
    ['Sets', `${d.setsLogged} / ${d.setsTotal}`, 'logged'],
    ['Planned volume', planned ? `${num(planned, 0)} ${d.unit}` : '–'],
    ['Logged volume', `${num(d.volume, 0)} ${d.unit}`, 'warm-ups excluded'],
    ['Duration', duration(d.minutes)],
  ];
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--sport-strength) 12%, var(--background)) 0%, var(--background) 60%)' }}
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--sport-strength)' }}>
            <Dumbbell aria-hidden className="h-4 w-4" /> Strength · {formatDay(d.day)}
            {start ? ` · ${start}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--viz-ink)]">{d.title || 'Lift session'}</h2>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', state.className)}>{state.label}</span>
          </div>
          {d.note && <p className="max-w-2xl whitespace-pre-wrap text-sm text-[var(--viz-ink-2)]">{d.note}</p>}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1 sm:grid-cols-5">
            {stats.map(([label, value, sub]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] text-[var(--viz-muted)]">{label}</dt>
                <dd className="truncate text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{value}</dd>
                {sub && <dd className="text-[10px] text-[var(--viz-muted)]">{sub}</dd>}
              </div>
            ))}
          </dl>
        </div>
        <Ring pct={pct} logged={d.setsLogged} total={d.setsTotal} />
      </div>

      {muscles.length > 0 && (
        <div className="border-t bg-background/60 px-5 py-4 sm:px-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">Muscles worked (sets)</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {muscles.map((m) => (
              <li key={m.muscle} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--viz-ink)]">{muscleLabel(m.muscle)}</span>
                  <span className="tabular-nums text-[var(--viz-muted)]">{num(m.sets)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(m.sets / most) * 100}%`, background: 'var(--sport-strength)' }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.exercises.length > 0 && (
        <ol className="flex gap-3 overflow-x-auto border-t bg-background/60 px-5 py-4 sm:px-6">
          {d.exercises.map((e, i) => {
            const working = e.sets.filter((s) => s.kind !== 'warmUp');
            const done = working.filter((s) => s.status === 'done').length;
            return (
              <li key={e.id} className="w-24 shrink-0">
                <a href={`#ex-${e.id}`} className="group block space-y-1.5">
                  <div className="relative">
                    <ExerciseThumb image={e.media?.image} gif={e.media?.gif} name={e.name} size="lg" className="!h-24 !w-24 transition group-hover:ring-2 group-hover:ring-[var(--sport-strength)]" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">{i + 1}</span>
                    {working.length > 0 && done === working.length && (
                      <span className="absolute right-1 top-1 rounded-full bg-[var(--viz-good)] px-1 text-[10px] font-semibold text-white">✓</span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-tight text-[var(--viz-ink-2)] group-hover:text-[var(--viz-ink)]">{e.name}</p>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Sets logged as a ring. */
function Ring({ pct, logged, total }: { pct: number; logged: number; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-28 w-28 shrink-0 place-items-center self-start lg:self-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--viz-grid)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--sport-strength)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <div className="text-center">
        <p className="text-xl font-semibold tabular-nums text-[var(--viz-ink)]">
          {logged}/{total}
        </p>
        <p className="text-[10px] text-[var(--viz-muted)]">sets logged</p>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/lift" className="text-sm text-muted-foreground hover:underline">
      Back to overview
    </Link>
  );
}
