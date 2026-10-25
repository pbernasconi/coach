// Paolo's rule (2026-10-24, src/lib/planner/prompts/coaching.md): one session a day, or one stacked block. He drops a second
// session that comes hours after the first, and he won't run after a lift. This turns any day a plan gives two or
// more timed sessions into one block: runs before lifts, each session starting when the one before it ends.
// rowsFromPlan applies it, so every accepted plan gets it. Pure, so node --test can run it.

import { sportOf } from './week.mjs';

const GAP_MIN = 15;

/** @param {string} s "YYYY-MM-DDTHH:MM[:SS]" → minutes since midnight */
function minutes(s) {
  const [h, m] = s.slice(11, 16).split(':').map(Number);
  return h * 60 + m;
}

/** @param {string} day @param {number} min */
function at(day, min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${day}T${h}:${m}:00`;
}

/**
 * The plan's events with each day's timed sessions stacked into one block, and a line per day it changed.
 * The array order (and so each event's import key) stays the same; only start and end move.
 * @param {any[]} events
 * @returns {{ events: any[], changes: string[] }}
 */
export function stackDays(events) {
  const out = events.map((e) => ({ ...e }));
  const changes = [];
  const byDay = new Map();
  out.forEach((e, i) => {
    const s = String(e?.start ?? '');
    const end = String(e?.end ?? '');
    if (s.length < 16 || end.length < 16 || end.slice(0, 10) !== s.slice(0, 10)) return;
    const sport = sportOf(e);
    if (sport === 'rest') return;
    const day = s.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({ i, sport, start: minutes(s), len: minutes(end) - minutes(s) });
  });
  for (const [day, items] of byDay) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.start - b.start);
    // A run never follows a lift: runs move ahead of the day's lifts, everything else keeps its order.
    const order = [...items].sort((a, b) => rank(a, items) - rank(b, items));
    if (items[0].start + items.reduce((n, it) => n + it.len, 0) > 24 * 60) continue;
    let t = items[0].start;
    let moved = false;
    for (const it of order) {
      // A short gap (changing, walking to the gym) is fine; a longer one, or an overlap, closes up.
      const start = it.start >= t && it.start - t <= GAP_MIN ? it.start : t;
      if (start !== it.start) {
        moved = true;
        out[it.i].start = at(day, start);
        out[it.i].end = at(day, start + it.len);
      }
      t = start + it.len;
    }
    if (moved) changes.push(`${day}: ${order.map((it) => out[it.i].title).join(' → ')} stacked into one block from ${at(day, items[0].start).slice(11, 16)}.`);
  }
  return { events: out, changes };
}

/** @typedef {{ i: number, sport: string, start: number, len: number }} Item */

/**
 * Sort key: position in time, except a run goes before every lift of the day.
 * @param {Item} it @param {Item[]} items
 */
function rank(it, items) {
  const pos = items.indexOf(it);
  if (it.sport !== 'run') return pos;
  const firstLift = items.findIndex((/** @type {Item} */ x) => x.sport === 'strength');
  return firstLift >= 0 && firstLift < pos ? firstLift - 0.5 : pos;
}
