'use client';

import { useState, useTransition } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Input, cn } from '@kobo/web';
import type { Verdict } from '@/lib/plan/history';
import { saveVerdictAction } from './actions';

/** Good or bad, and one line why. Saves on each tap and when the note loses focus. */
export default function VerdictControl({ item, weekStart, verdict: initial, note: initialNote }: {
  item: string; weekStart: string; verdict: Verdict | null; note: string | null;
}) {
  const [verdict, setVerdict] = useState(initial);
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(initialNote ?? '');
  const [pending, start] = useTransition();
  const save = (v: Verdict | null, n: string) =>
    start(async () => {
      try {
        await saveVerdictAction(item, weekStart, v, n);
        setSaved(n);
      } catch {
        toast.error('Could not save. Try again.');
      }
    });
  const pick = (v: Verdict) => {
    const next = verdict === v ? null : v;
    setVerdict(next);
    save(next, note);
  };
  const btn = (v: Verdict, on: string) =>
    cn('inline-flex size-8 items-center justify-center rounded-md border border-line-strong text-ink-muted hover:bg-surface-raised',
      verdict === v && on);
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-pressed={verdict === 'good'} aria-label="Good plan" disabled={pending} className={btn('good', 'border-success-line bg-success-soft text-success-ink')} onClick={() => pick('good')}>
        <ThumbsUp className="size-4" />
      </button>
      <button type="button" aria-pressed={verdict === 'bad'} aria-label="Bad plan" disabled={pending} className={btn('bad', 'border-danger-line bg-danger-soft text-danger-ink')} onClick={() => pick('bad')}>
        <ThumbsDown className="size-4" />
      </button>
      <Input
        aria-label="Why"
        placeholder={verdict === 'bad' ? 'What was wrong?' : 'Why? (one line)'}
        value={note}
        maxLength={300}
        disabled={!verdict}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => verdict && note !== saved && save(verdict, note)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 min-w-0 flex-1 text-sm"
      />
    </div>
  );
}
