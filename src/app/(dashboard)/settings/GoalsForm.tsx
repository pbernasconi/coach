'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { saveGoalsAction } from './actions';
import { GOAL_KINDS, describe, pace, parseValue, type Goal, type GoalKind } from '@/lib/goals/goals.mjs';

type Row = { id: string; kind: GoalKind; title: string; target: string; baseline: string; start: string; deadline: string };

const KINDS = Object.entries(GOAL_KINDS) as [GoalKind, (typeof GOAL_KINDS)[GoalKind]][];
const text = (kind: GoalKind, v: number) => (kind === 'run_10k_pace' ? pace(v) : String(v));
const toRow = (g: Goal): Row => ({
  id: g.id, kind: g.kind, title: g.title ?? '', target: text(g.kind, g.target), baseline: text(g.kind, g.baseline), start: g.start, deadline: g.deadline,
});
const input = 'rounded-md border bg-background px-2 py-1';

/** Edits the milestone goals. Pace is "m:ss" per km; the other kinds are numbers in their unit. */
export default function GoalsForm({ goals }: { goals: Goal[] }) {
  const [rows, setRows] = useState<Row[]>(goals.map(toRow));
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function save() {
    const out = rows.map((r) => ({ ...r, target: parseValue(r.kind, r.target), baseline: parseValue(r.kind, r.baseline) }));
    const bad = out.findIndex((g) => !Number.isFinite(g.target) || g.target <= 0 || !Number.isFinite(g.baseline) || !g.start || !g.deadline || g.start > g.deadline);
    if (bad >= 0) {
      toast.error(`Goal ${bad + 1}: fill in the target, the baseline and the dates (start before deadline). Pace is m:ss.`);
      return;
    }
    start(async () => {
      await saveGoalsAction(out);
      toast.success('Goals saved');
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-muted-foreground">No goals yet.</p>}
      {rows.map((r, i) => {
        const unit = GOAL_KINDS[r.kind].unit;
        const target = parseValue(r.kind, r.target);
        return (
          <div key={r.id} className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-6">
            <select value={r.kind} onChange={(e) => set(i, { kind: e.target.value as GoalKind })} className={`${input} sm:col-span-2`} aria-label="Kind">
              {KINDS.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input
              value={r.title}
              onChange={(e) => set(i, { title: e.target.value })}
              placeholder={Number.isFinite(target) ? describe({ kind: r.kind, target } as Goal) : 'Title (optional)'}
              className={`${input} sm:col-span-4`}
              aria-label="Title"
            />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Baseline ({unit})
              <input value={r.baseline} onChange={(e) => set(i, { baseline: e.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Target ({unit})
              <input value={r.target} onChange={(e) => set(i, { target: e.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">Start
              <input type="date" value={r.start} onChange={(e) => set(i, { start: e.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">Deadline
              <input type="date" value={r.deadline} onChange={(e) => set(i, { deadline: e.target.value })} className={input} />
            </label>
            <div className="flex items-end sm:col-span-6 sm:justify-end">
              <Button size="sm" variant="ghost" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => setRows([...rows, { id: Math.random().toString(36).slice(2, 10), kind: 'ride_km', title: '', target: '', baseline: '0', start: '', deadline: '' }])}
        >
          Add goal
        </Button>
        <Button size="sm" type="button" disabled={pending} onClick={save}>Save goals</Button>
      </div>
    </div>
  );
}
