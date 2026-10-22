'use client';

import { useEffect, useRef, useState } from 'react';
import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react';
import { Textarea } from '@kobo/web';
import { cn } from '@/lib/utils';
import { FEEL_LABELS, RPE_SCALE } from '@/lib/plan/feedback.mjs';
import type { Feedback } from '@/lib/plan/feedback';
import { loadFeedbackAction, saveFeedbackAction } from './actions';
import { Card } from './PlannedDetails';

const FACES: LucideIcon[] = [Frown, Annoyed, Meh, Smile, Laugh];

/** The RPE track: easy blue to max red, as in TrainingPeaks. */
const TRACK = 'linear-gradient(90deg, #3b82f6 0%, #22c55e 30%, #eab308 55%, #f59e0b 75%, #ef4444 100%)';

type Value = { feel: number | null; rpe: number | null; comment: string };

/**
 * How the workout went: the feel (five faces), the perceived effort (RPE 1–10) and a comment. Saves as it changes.
 * `item` is 'plan:<id>', 'strava:<id>' or 'lift:<id>'; a row logged on the same planned workout from another view
 * is shown and updated in place.
 */
export default function EffortLog({ item, date, title, planActivityId, className }: { item: string; date: string; title: string; planActivityId: string | null; className?: string }) {
  const [v, setV] = useState<Value>({ feel: null, rpe: null, comment: '' });
  const [key, setKey] = useState(item);
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    loadFeedbackAction([item], planActivityId).then(
      (f: Feedback | null) => {
        if (!live) return;
        if (f) {
          setV({ feel: f.feel, rpe: f.rpe, comment: f.comment ?? '' });
          setKey(f.item);
        } else {
          setV({ feel: null, rpe: null, comment: '' });
          setKey(item);
        }
        setState('idle');
      },
      () => live && setState('idle')
    );
    return () => {
      live = false;
    };
  }, [item, planActivityId]);

  const save = (next: Value, delay = 0) => {
    setV(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState('saving');
      try {
        const r = await saveFeedbackAction({ item: key, date, title, planActivityId, ...next });
        setState('error' in r ? 'error' : 'saved');
      } catch {
        setState('error');
      }
    }, delay);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const rpe = v.rpe ? RPE_SCALE[v.rpe - 1] : null;
  const note = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? <span className="text-[var(--viz-down)]">Not saved</span> : null;

  return (
    <Card title="How did it go?" note={note} className={className}>
      <div aria-busy={state === 'loading'} className={cn('space-y-4 transition-opacity', state === 'loading' && 'opacity-50')}>
        <fieldset>
          <legend className="mb-2 text-xs text-[var(--viz-muted)]">How did you feel?</legend>
          <div className="grid grid-cols-5 gap-1">
            {FACES.map((Face, i) => {
              const n = i + 1;
              const on = v.feel === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => save({ ...v, feel: on ? null : n })}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'bg-accent text-[var(--viz-ink)]' : 'text-[var(--viz-muted)] hover:bg-accent/60 hover:text-[var(--viz-ink-2)]'
                  )}
                >
                  <Face aria-hidden className={cn('h-6 w-6', on && 'text-[var(--viz-ctl)]')} strokeWidth={1.5} />
                  <span className="leading-tight">{FEEL_LABELS[i]}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="border-t pt-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <label htmlFor={`rpe-${item}`} className="text-xs text-[var(--viz-muted)]">
              Perceived effort (RPE)
            </label>
            {v.rpe ? (
              <button type="button" onClick={() => save({ ...v, rpe: null })} className="text-[11px] text-[var(--viz-muted)] hover:text-[var(--viz-ink)]">
                Clear
              </button>
            ) : null}
          </div>
          <p className="flex items-baseline gap-2 text-sm">
            <span className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{v.rpe ?? '–'}</span>
            <span className="font-medium text-[var(--viz-ink)]">{rpe?.[0] ?? 'Not logged'}</span>
            {rpe && <span className="truncate text-xs text-[var(--viz-muted)]">{rpe[1]}</span>}
          </p>
          <input
            id={`rpe-${item}`}
            type="range"
            min={1}
            max={10}
            step={1}
            value={v.rpe ?? 5}
            aria-valuetext={v.rpe ? `${v.rpe}, ${rpe?.[0]}` : 'Not logged'}
            onChange={(e) => save({ ...v, rpe: Number(e.target.value) }, 400)}
            onClick={(e) => v.rpe == null && save({ ...v, rpe: Number((e.target as HTMLInputElement).value) })}
            className={cn('rpe-range mt-2 w-full', v.rpe == null && 'rpe-unset')}
            style={{ '--rpe-track': TRACK } as React.CSSProperties}
          />
          <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-[var(--viz-muted)]">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="w-3 text-center">{i + 1}</span>
            ))}
          </div>
        </div>

        <div className="border-t pt-3">
          <label htmlFor={`fb-${item}`} className="mb-1.5 block text-xs text-[var(--viz-muted)]">
            Comment
          </label>
          <Textarea
            id={`fb-${item}`}
            rows={2}
            value={v.comment}
            placeholder="Optional"
            onChange={(e) => save({ ...v, comment: e.target.value }, 900)}
            className="min-h-14 text-sm"
          />
        </div>
      </div>
    </Card>
  );
}
