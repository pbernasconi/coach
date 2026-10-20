'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EventWithCountdown } from '@/lib/performance/events';
import { EVENT_SPORTS, PRIORITIES } from '@/lib/performance/events.mjs';
import { deleteEventAction, saveEventAction, type EventInput } from './event-actions';

const EMPTY: EventInput = { name: '', date: '', priority: 'B', sport: '', notes: '', target: '' };
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
// 16 px text on a phone: iOS zooms the page into a smaller input on focus.
const input = 'w-full rounded-md border bg-background px-2 py-2 text-base md:py-1.5 md:text-sm';

function EventForm({ initial, id, onDone }: { initial: EventInput; id?: string; onDone: () => void }) {
  const [e, setE] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof EventInput) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setE({ ...e, [k]: ev.target.value });
  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const r = await saveEventAction(e, id);
          if (!r.ok) toast.error(r.error);
          else {
            toast.success(id ? 'Event saved' : 'Event added');
            onDone();
          }
        });
      }}
    >
      <label className="col-span-2 space-y-1 sm:col-span-3">
        <span className="text-xs text-muted-foreground">Name</span>
        <input required autoFocus maxLength={120} value={e.name} onChange={set('name')} className={input} placeholder="Berkeley Hills Road Race" />
      </label>
      <label className="col-span-2 space-y-1 sm:col-span-2">
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
      <label className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-xs text-muted-foreground">Target</span>
        <input maxLength={200} value={e.target} onChange={set('target')} className={input} placeholder="Top 10, sub 1:35…" />
      </label>
      <label className="col-span-2 space-y-1 sm:col-span-6">
        <span className="text-xs text-muted-foreground">Notes</span>
        <textarea maxLength={2000} rows={2} value={e.notes} onChange={set('notes')} className={input} />
      </label>
      <div className="col-span-2 flex gap-2 sm:col-span-6">
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Saving…' : id ? 'Save' : 'Add event'}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function EventRow({ e }: { e: EventWithCountdown }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) {
    return (
      <li className="py-3">
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
    <li className="group flex items-center gap-3 py-2.5">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${e.priority === 'A' ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground'}`}
        title={`Priority ${e.priority}`}
      >
        {e.priority}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{e.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {fmtDate(e.date)}
          {e.sport ? ` · ${e.sport}` : ''}
          {e.target ? ` · target: ${e.target}` : ''}
        </div>
        {e.notes && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{e.notes}</p>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums">{c.label}</div>
        {c.days > 0 && <div className="text-xs tabular-nums text-muted-foreground">{c.days} days</div>}
      </div>
      <div className="flex shrink-0">
        <Button size="icon" variant="ghost" aria-label={`Edit ${e.name}`} title="Edit" onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${e.name}`}
          title="Delete"
          disabled={pending}
          className="text-muted-foreground hover:text-rose-600"
          onClick={() => {
            if (!confirm(`Delete “${e.name}”?`)) return;
            start(async () => {
              await deleteEventAction(e.id);
              toast.success('Event deleted');
            });
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

/** Add, edit and delete events. The lists come from the server (revalidated after each change). */
export default function EventsEditor({ upcoming, past }: { upcoming: EventWithCountdown[]; past: EventWithCountdown[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground">No upcoming events.</p>
      ) : (
        <ul className="-mt-2.5 divide-y">{upcoming.map((e) => <EventRow key={e.id} e={e} />)}</ul>
      )}
      {adding ? (
        <div className="rounded-md border bg-muted/30 p-3">
          <EventForm initial={EMPTY} onDone={() => setAdding(false)} />
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Add event
        </Button>
      )}
      {past.length > 0 && (
        <details className="border-t pt-3">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">Past events ({past.length})</summary>
          <ul className="divide-y">{past.map((e) => <EventRow key={e.id} e={e} />)}</ul>
        </details>
      )}
    </div>
  );
}
