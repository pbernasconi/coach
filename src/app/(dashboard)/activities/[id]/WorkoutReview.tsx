'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RangeRow } from './ActivityHover';

type Step = {
  index: number; label: string; kind: string; zone: string; inRepeat: boolean; plannedText: string; doneText: string; hrText: string;
  inTargetText: string | null; verdict: string; verdictLabel: string; plannedSeconds: number | null; doneSeconds: number;
  fromBucket: number | null; toBucket: number | null;
};
type RepeatSet = {
  title: string; summary: string;
  reps: { label: string; verdict: string; text: string; hrText: string | null }[];
  stats: { label: string; value: string }[];
};
/** reviewView(...) in src/lib/activity/review-view.mjs. */
export type ReviewSection = {
  score: number | null; level: string | null; scoreWord: string; workoutName: string | null; alignedText: string; extraText: string | null;
  steps: Step[]; sets: RepeatSet[]; flags: string[];
  ai: {
    status: 'ready' | 'pending' | 'failed' | 'off'; note: string | null; headline: string | null; rating: string | null; ratingLabel: string | null;
    sections: { key: string; title: string; items: string[] }[];
  };
};

/** The colour of a verdict (the plan calendar's status colours). */
const VERDICT_COLOR: Record<string, string> = {
  hit: 'var(--plan-good)',
  close: 'var(--plan-partial)',
  easy: 'var(--plan-off)',
  hard: 'var(--plan-off)',
  short: 'var(--plan-off)',
  missed: 'var(--plan-missed)',
};
const LEVEL_COLOR: Record<string, string> = { good: 'var(--plan-good)', partial: 'var(--plan-partial)', off: 'var(--plan-off)' };
/** Bar height of a step in the strip, by its zone (as the workout chart). */
const ZONE_HEIGHT: Record<string, number> = { Z1: 30, Z2: 45, Z2top: 52, Z3: 64, Z4: 80, Z4top: 86, Z5: 100 };

function Score({ score, level, word }: { score: number | null; level: string | null; word: string }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = LEVEL_COLOR[level ?? ''] ?? 'var(--viz-muted)';
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Plan score ${score ?? '–'} of 100`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--viz-band)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" className="fill-[var(--viz-ink)] text-[17px] font-semibold tabular-nums">{score ?? '–'}</text>
      </svg>
      <div className="leading-tight">
        <p className="text-sm font-medium" style={{ color }}>{word}</p>
        <p className="text-xs text-[var(--viz-muted)]">Plan score</p>
      </div>
    </div>
  );
}

/** The workout as a strip of steps, each as wide as its planned time and as tall as its zone, coloured by its verdict. */
function StepStrip({ steps }: { steps: ReviewSection['steps'] }) {
  const total = steps.reduce((n, s) => n + Math.max(30, s.plannedSeconds ?? s.doneSeconds ?? 60), 0);
  return (
    <div className="flex h-14 items-end gap-[2px]" role="img" aria-label="The workout's steps coloured by how each went">
      {steps.map((s) => (
        <div
          key={s.index}
          title={`${s.label}: ${s.verdictLabel}`}
          className="rounded-t-[3px]"
          style={{
            width: `${(Math.max(30, s.plannedSeconds ?? s.doneSeconds ?? 60) / total) * 100}%`,
            height: `${ZONE_HEIGHT[s.zone] ?? 40}%`,
            background: VERDICT_COLOR[s.verdict] ?? 'var(--viz-muted)',
            opacity: s.kind === 'work' ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [['hit', 'On target'], ['close', 'Close'], ['hard', 'Too hard or too easy'], ['missed', 'Not done']];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--viz-muted)]">
      {items.map(([k, label]) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ background: VERDICT_COLOR[k] }} />
          {label}
        </li>
      ))}
    </ul>
  );
}

function AiPart({ ai, busy }: { ai: ReviewSection['ai']; busy: boolean }) {
  if (busy || ai.status === 'pending') {
    if (ai.sections.length) return <Sections ai={ai} stale />;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-[var(--viz-ink-2)]" role="status">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Coach is reviewing this workout…
      </div>
    );
  }
  if (!ai.sections.length) return ai.note ? <p className="text-sm text-[var(--viz-muted)]">{ai.note}</p> : null;
  return <Sections ai={ai} />;
}

function Sections({ ai, stale = false }: { ai: ReviewSection['ai']; stale?: boolean }) {
  return (
    <div className={`grid gap-x-8 gap-y-5 md:grid-cols-2 ${stale ? 'opacity-60' : ''}`}>
      {ai.sections.map((s, i, all) => (
        // The effect spans the row; so does a last list that would sit alone in its row.
        <div key={s.key} className={s.key === 'effect' || (i === all.length - 1 && all.filter((x) => x.key !== 'effect').length % 2 === 1) ? 'md:col-span-2' : ''}>
          <h3 className="mb-1.5 text-sm font-semibold">{s.title}</h3>
          {s.key === 'effect' ? (
            <p className="text-sm leading-relaxed text-[var(--viz-ink-2)]">{s.items[0]}</p>
          ) : (
            <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--viz-ink-2)]">
              {s.items.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.key === 'well' ? 'var(--plan-good)' : s.key === 'improve' ? 'var(--plan-off)' : 'var(--viz-ink-2)' }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const th = 'px-2 py-1.5 text-left font-medium whitespace-nowrap';
const td = 'px-2 py-1.5 whitespace-nowrap tabular-nums';

/**
 * The coach's review of a planned workout: the plan score and Claude's verdict, the steps as a strip, what it did for
 * you, what went well, what to improve and tips for next time, each repeat rep by rep, and the step table (a row
 * highlights its stretch on the charts and the map). When the review is missing or out of date it asks for one.
 */
export default function WorkoutReview({ activityId, initial }: { activityId: string; initial: ReviewSection }) {
  const [section, setSection] = useState(initial);
  const [busy, setBusy] = useState(initial.ai.status === 'pending');
  const asked = useRef(false);

  useEffect(() => {
    if (initial.ai.status !== 'pending' || asked.current) return;
    asked.current = true;
    const ctl = new AbortController();
    fetch(`/api/activities/${encodeURIComponent(activityId)}/review`, { method: 'POST', signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: ReviewSection | null) => {
        if (s) setSection(s);
        else setSection((cur) => ({ ...cur, ai: { ...cur.ai, status: 'failed', note: "Coach couldn't write the review. Reload to try again." } }));
      })
      .catch(() => {})
      .finally(() => setBusy(false));
    return () => ctl.abort();
  }, [activityId, initial.ai.status]);

  const { ai } = section;
  return (
    <section id="review" className="scroll-mt-32 space-y-4" aria-labelledby="review-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="review-h" className="text-lg font-semibold">Workout review</h2>
        <p className="text-xs text-[var(--viz-muted)]">{[section.workoutName, section.alignedText].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="space-y-5 rounded-xl border bg-[var(--viz-surface)] p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Score score={section.score} level={section.level} word={section.scoreWord} />
          <div className="min-w-0 flex-1 basis-[22rem]">
            {ai.headline ? (
              <p className="text-base font-medium leading-snug">
                <Sparkles aria-hidden className="mr-1.5 inline h-4 w-4 -translate-y-px text-[var(--viz-muted)]" />
                {ai.headline}
              </p>
            ) : (
              <p className="text-sm text-[var(--viz-ink-2)]">{section.sets[0] ? `${section.sets[0].title}: ${section.sets[0].summary}.` : 'Plan versus done, step by step.'}</p>
            )}
            {ai.ratingLabel && <p className="mt-0.5 text-xs text-[var(--viz-muted)]">Coach&apos;s rating: {ai.ratingLabel}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <StepStrip steps={section.steps} />
          <Legend />
        </div>
        <AiPart ai={ai} busy={busy} />
        {!ai.sections.length && !busy && ai.status !== 'pending' && section.flags.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--viz-ink-2)]">
            {section.flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
      </div>

      {section.sets.map((set, i) => (
        <div key={i} className="rounded-xl border bg-[var(--viz-surface)] p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{set.title}</h3>
            <p className="text-sm text-[var(--viz-ink-2)]">{set.summary}</p>
          </div>
          <ol className="mb-4 flex flex-wrap gap-2">
            {set.reps.map((r) => (
              <li key={r.label} className="min-w-[5.5rem] rounded-lg border px-3 py-2" style={{ borderColor: VERDICT_COLOR[r.verdict] }}>
                <p className="text-[11px] text-[var(--viz-muted)]">{r.label.replace(/\s*\/\d+$/, '')}</p>
                <p className="text-base font-semibold tabular-nums">{r.text}</p>
                {r.hrText && <p className="text-[11px] tabular-nums text-[var(--viz-ink-2)]">{r.hrText}</p>}
              </li>
            ))}
          </ol>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {set.stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-[var(--viz-muted)]">{s.label}</dt>
                <dd className="font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
        <table className="w-full text-sm">
          <caption className="sr-only">Each planned step and what was done</caption>
          <thead className="text-xs text-[var(--viz-muted)]">
            <tr>
              <th className={`${th} pl-3`}>Step</th>
              <th className={th}>Planned</th>
              <th className={th}>Done</th>
              <th className={th}>HR</th>
              <th className={`${th} pr-3`}>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {section.steps.map((s) => (
              <RangeRow
                key={s.index}
                range={s.fromBucket != null && s.toBucket != null ? { key: `step-${s.index}`, label: s.label, from: s.fromBucket, to: s.toBucket } : null}
                className={`border-t ${s.inRepeat && s.kind !== 'work' ? 'text-[var(--viz-ink-2)]' : ''}`}
              >
                <td className={`${td} pl-3 ${s.kind === 'work' ? 'font-medium' : ''}`}>{s.label}</td>
                <td className={`${td} text-[var(--viz-ink-2)]`}>{s.plannedText}</td>
                <td className={td}>{s.doneText}</td>
                <td className={td}>{s.hrText}</td>
                <td className={`${td} pr-3`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: VERDICT_COLOR[s.verdict] }} />
                    {s.verdictLabel}
                    {s.inTargetText && <span className="text-xs text-[var(--viz-muted)]">· {s.inTargetText}</span>}
                  </span>
                </td>
              </RangeRow>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--viz-muted)]">{section.extraText ? `${section.extraText}. ` : ''}Hover or click a step to see it on the charts and the map.</p>
    </section>
  );
}
