'use client';

import { useState } from 'react';
import { ArrowUp, Undo2, X } from 'lucide-react';
import { Button, cn } from '@kobo/web';
import type { DraftEvent, PlannerWeek } from '@/lib/plan/planner-week';
import { freeSlots } from '@/lib/plan/planner-app.mjs';
import { clock, dayNum, hm, sportVar, weekday } from './plannerUi';

export type Answers = {
  feel: string | null; hours: number | null; gym: number | null; hard: number | null; longDay: string | null; daysOff: string[]; away: string[]; lock: string;
};

export const FEELS = [
  { id: 'fresh', label: 'Fresh' },
  { id: 'normal', label: 'Normal' },
  { id: 'fatigued', label: 'Tired' },
  { id: 'recovery', label: 'Recovery week' },
] as const;

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</div>;
}

export function Chip({ on, children, onClick, className }: { on?: boolean; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('rounded-full border px-3 py-1.5 text-sm transition-colors', on ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted', className)}>
      {children}
    </button>
  );
}

export function Segmented<T extends string | number | null>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-0.5">
      {options.map((o) => (
        <button key={String(o.v)} type="button" onClick={() => onChange(o.v)} aria-pressed={o.v === value}
          className={cn('rounded-full px-3 py-1 text-sm font-medium', o.v === value ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Why the week looks like this, the last change, quick asks, and the plan checks. */
export function CoachPanel({ data, onAsk, onUndo, busy }: { data: PlannerWeek; onAsk: (note: string) => void; onUndo: () => void; busy: boolean }) {
  const p = data.proposal;
  const review = p?.review;
  const issues = p?.checks?.issues ?? [];
  return (
    <div className="flex flex-col gap-4 text-sm">
      {data.change && (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          {data.change.note && <div className="self-end rounded-2xl rounded-br-sm bg-muted px-3 py-2">{data.change.note}</div>}
          <div className="flex items-center justify-between">
            <span className="font-semibold">Draft v{p?.version}</span>
            <Button variant="plain" size="compact" onClick={onUndo} disabled={busy}><Undo2 aria-hidden />Undo</Button>
          </div>
          {data.change.changed.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <Label>Changed</Label>
              {data.change.changed.map((c, i) => (
                <div key={i} className="flex justify-between gap-3"><span className="truncate">{c.what}</span><span className="shrink-0 text-muted-foreground">{c.how}</span></div>
              ))}
            </div>
          )}
          {data.change.gaveUp && (
            <div className="flex flex-col gap-0.5"><Label>Gave up</Label><span>{data.change.gaveUp}</span></div>
          )}
        </div>
      )}
      {!review && !p?.summary && (
        <p className="leading-relaxed text-muted-foreground">
          {p?.status === 'requested' || p?.status === 'running'
            ? 'Coach is drafting. Why the week looks the way it does shows here when it is ready.'
            : 'Once Coach drafts the week, this is where it explains why: the reasoning, the trade-offs and what to watch. Then ask for changes below.'}
        </p>
      )}
      {review?.headline && <p className="text-base font-semibold">{review.headline}</p>}
      {review?.reasoning.map((r, i) => <p key={i} className="leading-relaxed">{r}</p>)}
      {!review && p?.summary && <p className="leading-relaxed whitespace-pre-line">{p.summary}</p>}
      {review && review.decisions.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Decisions</Label>
          {review.decisions.map((d, i) => (
            <div key={i} className="flex flex-col">
              <span className="font-medium">{d.title}</span>
              {d.why && <span className="text-muted-foreground">{d.why}</span>}
              {d.tradeoff && <span className="text-muted-foreground">Trade-off: {d.tradeoff}</span>}
            </div>
          ))}
        </div>
      )}
      {review && review.watch.length > 0 && (
        <div className="flex flex-col gap-1"><Label>Watch for</Label>{review.watch.map((w, i) => <span key={i}>{w}</span>)}</div>
      )}
      {issues.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label>Plan checks</Label>
          {issues.map((i, k) => (
            <span key={k} className={cn(i.level === 'fail' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400')}>{i.message}</span>
          ))}
        </div>
      )}
      {p?.status === 'proposed' && (
        <div className="flex flex-wrap gap-1.5">
          {['Make it lighter', 'Swap the hard day', 'Long ride instead of the long run', 'One more easy day'].map((q) => (
            <Chip key={q} className="py-1 text-xs" onClick={() => onAsk(q)}>{q}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** The note box at the bottom of the panel: "Tell Coach what to change". */
export function Composer({ onSend, disabled }: { onSend: (note: string) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 pl-3">
      <textarea value={text} rows={1} maxLength={1000} disabled={disabled} placeholder="Tell Coach what to change"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
      <Button size="icon-compact" aria-label="Send to Coach" disabled={disabled || !text.trim()} onClick={send}><ArrowUp aria-hidden /></Button>
    </div>
  );
}

/** One session: what it is, why, and Move, Shorten, Remove, or ask Coach to swap it. */
export function SessionPanel({ data, event, onClose, onMove, onLength, onRemove, onAsk, busy }: {
  data: PlannerWeek; event: DraftEvent; onClose: () => void; busy: boolean;
  onMove: (date: string, time: string) => void; onLength: (minutes: number) => void; onRemove: () => void; onAsk: (note: string) => void;
}) {
  const [len, setLen] = useState(event.minutes ?? 60);
  const slots = freeSlots(data, event);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-2">
        <Button variant="plain" size="icon-compact" aria-label="Back" onClick={onClose}><X aria-hidden /></Button>
        <span className="text-muted-foreground">Back</span>
      </div>
      <div className="flex gap-3">
        <div className="w-1.5 shrink-0 rounded-full" style={{ background: sportVar(event) }} />
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 text-lg font-semibold">
            {event.title}
            {event.hard && <span className="rounded bg-rose-600 px-1.5 text-[10px] font-bold text-white">HARD</span>}
          </span>
          <span className="text-muted-foreground">
            {weekday(event.date)} {dayNum(event.date)}{event.start ? ` · ${clock(event.start)}` : ''}{event.minutes ? ` · ${hm(event.minutes)}` : ''}{event.tss ? ` · ${Math.round(event.tss)} TSS` : ''}
          </span>
        </div>
      </div>
      {event.why && <p className="rounded-xl bg-muted/60 px-3 py-2">{event.why}</p>}
      {event.description && <p className="max-h-56 overflow-auto leading-relaxed whitespace-pre-line text-muted-foreground">{event.description}</p>}
      {slots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Move to a free slot</Label>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <Chip key={`${s.date}${s.time}`} onClick={() => onMove(s.date, s.time)}>{weekday(s.date)} {clock(s.time)}</Chip>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Or drag it on the calendar.</span>
        </div>
      )}
      {event.minutes != null && (
        <div className="flex items-center gap-2">
          <Label>Length</Label>
          <Button variant="secondary" size="icon-compact" aria-label="15 minutes shorter" onClick={() => setLen((m) => Math.max(10, m - 15))}>−</Button>
          <span className="w-16 text-center font-semibold tabular-nums">{hm(len)}</span>
          <Button variant="secondary" size="icon-compact" aria-label="15 minutes longer" onClick={() => setLen((m) => Math.min(360, m + 15))}>+</Button>
          {len !== event.minutes && <Button size="compact" loading={busy} onClick={() => onLength(len)}>Save</Button>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="compact" disabled={busy} onClick={() => onAsk(`Swap ${weekday(event.date)}'s ${event.title} for something else that fits the week.`)}>Ask Coach to swap it</Button>
        <Button variant="destructive" size="compact" disabled={busy} onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
}
