// The coach's review of a proposed week (the planner writes it as `review` in the plan JSON, src/lib/planner/prompts/planner.md) and
// the load outlook Coach computes for it. Pure, so node --test can run it (review.test.mjs).

import { estimatePlannedTss, projectLoad } from '../performance/pmc.mjs';
import { addDays } from './week.mjs';

const clip = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, n) : null);
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

/**
 * The review in the plan JSON, cleaned for the page, or null when there is none. Bad entries are dropped, not
 * fatal: the plan itself is what the checks guard.
 * @param {any} input
 * @returns {{ headline: string | null, reasoning: string[], decisions: { title: string, why: string | null, tradeoff: string | null }[], watch: string[] } | null}
 */
export function cleanReview(input) {
  if (!input || typeof input !== 'object') return null;
  const reasoning = list(input.reasoning, 4).map((s) => clip(s, 200)).filter(Boolean);
  const decisions = list(input.decisions, 4)
    .map((d) => ({ title: clip(d?.title, 80), why: clip(d?.why, 200), tradeoff: clip(d?.tradeoff, 200) }))
    .filter((d) => d.title);
  const watch = list(input.watch, 3).map((s) => clip(s, 160)).filter(Boolean);
  const headline = clip(input.headline, 120);
  if (!headline && !reasoning.length && !decisions.length && !watch.length) return null;
  return { headline, reasoning, decisions, watch };
}

/**
 * An older plan's markdown summary ("**Fitness:** …", "- …" lines) as titled blocks, so it reads as sections
 * instead of raw text. Bold and markdown marks are removed.
 * @param {string | null} md
 * @returns {{ title: string | null, lines: string[] }[]}
 */
export function summaryBlocks(md) {
  if (!md) return [];
  const plain = (s) => {
    const t = s.replace(/\*\*/g, '').replace(/`/g, '').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const blocks = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line || /^#+\s*$/.test(line)) continue;
    const head = line.match(/^(?:#+\s*)?\*\*([^*]+?):?\*\*:?\s*(.*)$/) ?? line.match(/^#+\s+(.+?):?\s*()$/);
    if (head) {
      blocks.push({ title: plain(head[1]).replace(/:$/, ''), lines: head[2] ? [plain(head[2])] : [] });
      continue;
    }
    const text = plain(line.replace(/^[-*•]\s+/, ''));
    if (!blocks.length) blocks.push({ title: null, lines: [] });
    blocks.at(-1).lines.push(text);
  }
  return blocks.filter((b) => b.lines.length);
}

/**
 * Fitness, fatigue and form going into the week and at its end if the proposal is done as planned, with the week's
 * load against the last four weeks.
 *
 * @param {{ date: string, ctl: number, atl: number, tsb?: number, tss: number }[]} history  daily_training_load, oldest first
 * @param {{ date: string, tss?: number | null, duration?: number | null, sport?: string, workoutType?: string | null, intensity?: string | null, title?: string }[]} before
 *   workouts already planned between today and the week (not the week itself)
 * @param {{ date: string, tss?: number | null, duration?: number | null, activityType?: string, workoutType?: string | null, intensity?: string | null, title?: string }[]} rows
 *   the proposal's rows
 * @param {{ today: string, weekStart: string }} opts
 */
export function weekOutlook(history, before, rows, { today, weekStart }) {
  const weekEnd = addDays(weekStart, 6);
  const est = (w) => estimatePlannedTss({ ...w, sport: w.sport ?? w.activityType, status: 'planned' }).tss;
  const planned = [
    ...before.filter((w) => w.date >= today && w.date < weekStart).map((w) => ({ date: w.date, tss: est(w) })),
    ...rows.filter((r) => r.date >= today).map((r) => ({ date: r.date, tss: est(r) })),
  ];
  const plannedTss = Math.round(rows.reduce((n, r) => n + est(r), 0));
  const plannedMin = rows.reduce((n, r) => n + (r.activityType === 'rest' ? 0 : Number(r.duration ?? 0)), 0);
  const sessions = rows.filter((r) => r.activityType !== 'rest').length;

  // Four full weeks before the one that holds today.
  const thisMonday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const from = addDays(thisMonday, -28);
  const recent = history.filter((h) => h.date >= from && h.date < thisMonday);
  const avgTss = recent.length ? Math.round(recent.reduce((n, h) => n + Number(h.tss || 0), 0) / 4) : null;

  if (!history.length) return { plannedTss, plannedMin, sessions, avgTss, start: null, end: null };
  const series = projectLoad(history, planned, { today, until: weekEnd });
  const at = (d) => series.filter((s) => s.date <= d).at(-1) ?? null;
  const startDay = weekStart > today ? addDays(weekStart, -1) : addDays(today, -1);
  const pick = (s) => (s ? { ctl: s.ctl, atl: s.atl, tsb: s.tsb } : null);
  return { plannedTss, plannedMin, sessions, avgTss, start: pick(at(startDay)), end: pick(at(weekEnd)) };
}
