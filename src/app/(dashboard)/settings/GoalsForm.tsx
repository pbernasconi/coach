'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveGoalsAction } from './actions';
import { GOAL_KINDS, describe, pace, parseValue, type Goal, type GoalKind } from '@/lib/goals/goals.mjs';

type Row = { id: string; kind: GoalKind; title: string; target: string; baseline: string; start: string; deadline: string };

const KINDS = Object.entries(GOAL_KINDS) as [GoalKind, (typeof GOAL_KINDS)[GoalKind]][];
const text = (kind: GoalKind, v: number) => (kind === 'run_10k_pace' ? pace(v) : String(v));
const toRow = (g: Goal): Row => ({
  id: g.id, kind: g.kind, title: g.title ?? '', target: text(g.kind, g.target), baseline: text(g.kind, g.baseline), start: g.start, deadline: g.deadline,
});
// 16 px text on a phone: iOS zooms the page into a smaller input on focus.
const input = 'h-10 w-full min-w-0 rounded-md border bg-background px-2 text-base md:h-8 md:text-sm';
// Kind, title, baseline, target, unit, start, deadline, remove.
const COLS = 'lg:grid-cols-[9rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_8.5rem_8.5rem_2rem]';

/** Edits the milestone goals. Pace is "m:ss" per km; the other kinds are numbers in their unit. */
export default function GoalsForm({ goals }: { goals: Goal[] }) {
  const [saved, setSaved] = useState<Row[]>(goals.map(toRow));
  const [rows, setRows] = useState<Row[]>(saved);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const changed = JSON.stringify(rows) !== JSON.stringify(saved);

  function save() {
    const out = rows.map((r) => ({ ...r, target: parseValue(r.kind, r.target), baseline: parseValue(r.kind, r.baseline) }));
    const bad = out.findIndex((g) => !Number.isFinite(g.target) || g.target <= 0 || !Number.isFinite(g.baseline) || !g.start || !g.deadline || g.start > g.deadline);
    if (bad >= 0) {
      toast.error(`Goal ${bad + 1}: fill in the target, the baseline and the dates (start before deadline). Pace is m:ss.`);
      return;
    }
    start(async () => {
      await saveGoalsAction(out);
      setSaved(rows);
      toast.success('Goals saved');
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No goals yet.</p>
      ) : (
        <div className="space-y-3 lg:space-y-1.5">
          <div className={`hidden gap-2 px-0.5 text-xs text-muted-foreground lg:grid ${COLS}`} aria-hidden>
            <span>Kind</span><span>Title</span><span>Baseline</span><span>Target</span><span /><span>Start</span><span>Deadline</span><span />
          </div>
          {rows.map((r, i) => {
            const unit = GOAL_KINDS[r.kind].unit;
            const target = parseValue(r.kind, r.target);
            const label = (name: string) => <span className="text-xs text-muted-foreground lg:hidden">{name}</span>;
            return (
              <div key={r.id} className={`grid grid-cols-2 items-end gap-2 rounded-md border p-3 lg:items-center lg:rounded-none lg:border-0 lg:p-0 ${COLS}`}>
                <label className="col-span-2 space-y-1 lg:col-span-1 lg:space-y-0">{label('Kind')}
                  <select value={r.kind} onChange={(e) => set(i, { kind: e.target.value as GoalKind })} className={input} aria-label="Kind">
                    {KINDS.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </label>
                <label className="col-span-2 space-y-1 lg:col-span-1 lg:space-y-0">{label('Title')}
                  <input
                    value={r.title}
                    onChange={(e) => set(i, { title: e.target.value })}
                    placeholder={Number.isFinite(target) ? describe({ kind: r.kind, target } as Goal) : 'Title (optional)'}
                    className={input}
                    aria-label="Title"
                  />
                </label>
                <label className="space-y-1 lg:space-y-0">{label(`Baseline (${unit})`)}
                  <input value={r.baseline} onChange={(e) => set(i, { baseline: e.target.value })} className={input} aria-label={`Baseline (${unit})`} />
                </label>
                <label className="space-y-1 lg:space-y-0">{label(`Target (${unit})`)}
                  <input value={r.target} onChange={(e) => set(i, { target: e.target.value })} className={input} aria-label={`Target (${unit})`} />
                </label>
                <span className="hidden truncate text-xs text-muted-foreground lg:block" title={unit}>{unit}</span>
                <label className="space-y-1 lg:space-y-0">{label('Start')}
                  <input type="date" value={r.start} onChange={(e) => set(i, { start: e.target.value })} className={input} aria-label="Start" />
                </label>
                <label className="space-y-1 lg:space-y-0">{label('Deadline')}
                  <input type="date" value={r.deadline} onChange={(e) => set(i, { deadline: e.target.value })} className={input} aria-label="Deadline" />
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  aria-label={`Remove goal ${i + 1}`}
                  title="Remove"
                  className="col-span-2 w-full text-muted-foreground hover:text-rose-600 lg:col-span-1 lg:h-8 lg:w-8"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <X />
                  <span className="lg:hidden">Remove</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => setRows([...rows, { id: Math.random().toString(36).slice(2, 10), kind: 'ride_km', title: '', target: '', baseline: '0', start: '', deadline: '' }])}
        >
          <Plus /> Add goal
        </Button>
        <Button size="sm" type="button" disabled={pending || !changed} onClick={save}>{pending ? 'Saving…' : 'Save goals'}</Button>
        {changed && !pending && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}
