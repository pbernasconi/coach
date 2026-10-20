'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { EventWithCountdown } from '@/lib/performance/events';
import { EVENT_SPORTS, PRIORITIES } from '@/lib/performance/events.mjs';
import { deleteEventAction, saveEventAction, type EventInput } from './actions';

const EMPTY: EventInput = { name: '', date: '', priority: 'B', sport: '', notes: '', target: '' };
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';

function EventForm({ initial, id, onDone }: { initial: EventInput; id?: string; onDone: () => void }) {
  const [e, setE] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof EventInput) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setE({ ...e, [k]: ev.target.value });
  return (
    <form
      className="grid gap-3 sm:grid-cols-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const r = await saveEventAction(e, id);
          if (!r.ok) toast.error(r.error);
          else {
            toast.success(id ? 'Event saved' : 'Event added');
            if (!id) setE(EMPTY);
            onDone();
          }
        });
      }}
    >
      <label className="space-y-1 sm:col-span-3">
        <span className="text-xs text-muted-foreground">Name</span>
        <input required maxLength={120} value={e.name} onChange={set('name')} className={input} placeholder="Berkeley Hills Road Race" />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Date</span>
        <input required type="date" value={e.date} onChange={set('date')} className={input} />
      </label>
      <label className="space-y-1 sm:col-span-1">
        <span className="text-xs text-muted-foreground">Priority</span>
        <select value={e.priority} onChange={set('priority')} className={input}>
          {PRIORITIES.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Sport</span>
        <select value={e.sport} onChange={set('sport')} className={input}>
          <option value="">–</option>
          {EVENT_SPORTS.map((s: string) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </label>
      <label className="space-y-1 sm:col-span-4">
        <span className="text-xs text-muted-foreground">Target</span>
        <input maxLength={200} value={e.target} onChange={set('target')} className={input} placeholder="Top 10, sub 1:35…" />
      </label>
      <label className="space-y-1 sm:col-span-6">
        <span className="text-xs text-muted-foreground">Notes</span>
        <textarea maxLength={2000} rows={2} value={e.notes} onChange={set('notes')} className={input} />
      </label>
      <div className="flex gap-2 sm:col-span-6">
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Saving…' : id ? 'Save' : 'Add event'}</Button>
        {id && <Button size="sm" type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

function EventRow({ e }: { e: EventWithCountdown }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) {
    return (
      <li className="rounded-lg border p-3">
        <EventForm
          id={e.id}
          initial={{ name: e.name, date: e.date, priority: e.priority, sport: e.sport ?? '', notes: e.notes ?? '', target: e.target ?? '' }}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }
  const c = e.countdown;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 gap-3">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${e.priority === 'A' ? 'bg-foreground text-background' : ''}`}
          title={`Priority ${e.priority}`}
        >
          {e.priority}
        </span>
        <div className="min-w-0">
          <div className="font-medium">{e.name}</div>
          <div className="text-xs text-muted-foreground">
            {fmtDate(e.date)}
            {e.sport ? ` · ${e.sport}` : ''}
            {e.target ? ` · target: ${e.target}` : ''}
          </div>
          {e.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{e.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">{c.label}</div>
          {c.days > 0 && <div className="text-xs tabular-nums text-muted-foreground">{c.days} days</div>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete “${e.name}”?`)) return;
            start(async () => {
              await deleteEventAction(e.id);
              toast.success('Event deleted');
            });
          }}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

/** Add, edit and delete events. The lists come from the server (revalidated after each change). */
export default function GoalsEditor({ upcoming, past }: { upcoming: EventWithCountdown[]; past: EventWithCountdown[] }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Add an event</h2>
        <EventForm initial={EMPTY} onDone={() => {}} />
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          <ul className="space-y-2">{upcoming.map((e) => <EventRow key={e.id} e={e} />)}</ul>
        )}
      </section>
      {past.length > 0 && (
        <details className="rounded-lg border">
          <summary className="cursor-pointer select-none p-3 text-sm font-medium">Past events ({past.length})</summary>
          <ul className="space-y-2 p-3 pt-0">{past.map((e) => <EventRow key={e.id} e={e} />)}</ul>
        </details>
      )}
    </div>
  );
}
