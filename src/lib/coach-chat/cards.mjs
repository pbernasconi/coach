// @ts-check
// Cards Coach can show in the chat (lift/APP-API.md "Coach", lift/COACH-CHAT.md): a workout, a week, an exercise,
// readiness, or a day's timeline. Claude only names what to show (`show`, kind + ref); the server fills in the real
// data (cards.ts), so a card never carries a number the model made up. `suggest_replies` adds one-tap answers to a
// question. Pure: the tool definitions, the checks and the day timeline.

import { addDays, mondayOf } from '../plan/week.mjs';
import { hm } from './changes.mjs';

export const CARD_KINDS = ['workout', 'week', 'exercise', 'readiness', 'day'];
/** Cards in one answer. */
export const MAX_CARDS = 2;
/** One-tap answers under a question. */
export const MAX_REPLIES = 3;

export const SHOW_TOOL = {
  name: 'show',
  description:
    'Show Paolo a card in the chat, under your text. The server fills it with his real data, so name what to show, ' +
    'never numbers. kind "workout": ref = a workout id from <plan> ("what\'s tomorrow", "show me Friday"). ' +
    '"week": ref = any YYYY-MM-DD in that week ("how did my week go"). "exercise": ref = the exercise name as in ' +
    'his Lift templates ("how do I do an RDL", "what\'s my squat today"). "readiness": ref = today\'s YYYY-MM-DD ' +
    '("am I recovered", "I\'m flat"). "day": ref = YYYY-MM-DD, the day\'s meetings, free windows and sessions ("when ' +
    'can I fit the lift in"). At most 2 cards per answer; only when the card answers better than words.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: CARD_KINDS },
      ref: { type: 'string', description: 'A workout id, a YYYY-MM-DD day, or an exercise name.' },
    },
    required: ['kind', 'ref'],
  },
};

export const REPLIES_TOOL = {
  name: 'suggest_replies',
  description:
    'When your answer ends with a question, give Paolo up to 3 one-tap answers in his voice ("Tuesday 09:00", ' +
    '"Wednesday 07:00"). A tap sends it as his message. Only with a question.',
  input_schema: {
    type: 'object',
    properties: { options: { type: 'array', items: { type: 'string' }, description: 'Short answers, under 40 characters.' } },
    required: ['options'],
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {{ kind: 'workout' | 'week' | 'exercise' | 'readiness' | 'day', ref: string }} CardRef
 * @typedef {{ ok: true, value: CardRef } | { ok: false, problems: string[] }} CardCheck
 */

/**
 * A `show` call, checked: a workout id that is in the plan, a real day near now, an exercise name.
 * @param {any} input @param {{ rows: { id: string }[], today: string }} plan
 * @returns {CardCheck}
 */
export function checkCard(input, { rows, today }) {
  const kind = String(input?.kind ?? '');
  const ref = typeof input?.ref === 'string' ? input.ref.trim() : '';
  if (!CARD_KINDS.includes(kind)) return { ok: false, problems: [`kind must be one of ${CARD_KINDS.join(', ')}`] };
  if (!ref) return { ok: false, problems: ['ref is missing'] };
  const k = /** @type {CardRef['kind']} */ (kind);
  if (k === 'workout') {
    return rows.some((r) => r.id === ref) ? { ok: true, value: { kind: k, ref } } : { ok: false, problems: [`no workout with id ${ref} in <plan>`] };
  }
  if (k === 'exercise') return { ok: true, value: { kind: k, ref: ref.slice(0, 80) } };
  if (!DATE.test(ref)) return { ok: false, problems: [`ref for ${k} must be YYYY-MM-DD`] };
  if (k === 'readiness' && ref !== today) return { ok: false, problems: [`readiness is for today (${today}) only`] };
  if (ref < addDays(mondayOf(today), -28) || ref > addDays(today, 21)) {
    return { ok: false, problems: [`${ref} is out of range: from 4 weeks back to 3 weeks ahead`] };
  }
  return { ok: true, value: { kind: k, ref } };
}

/** @param {any} input @returns {string[]} */
export function cleanReplies(input) {
  /** @type {unknown[]} */
  const list = Array.isArray(input?.options) ? input.options : [];
  return [...new Set(list.filter((o) => typeof o === 'string').map((o) => /** @type {string} */ (o).trim().slice(0, 60)).filter(Boolean))].slice(0, MAX_REPLIES);
}

/** "HH:MM" of an ISO time in a zone. @param {string} iso @param {string} timeZone */
export function clock(iso, timeZone) {
  const t = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  return t === '24:00' ? '00:00' : t;
}

const mins = (/** @type {string} */ t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const at = (/** @type {number} */ m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * A day as a timeline from 06:00 to 22:00: the meetings (busy), the planned sessions, and the gaps of 30 minutes or
 * more between them (free). Overlapping meetings merge into one busy block with the first title.
 * @param {{ date: string, timeZone: string, events: { title: string, start: string, end: string, allDay: boolean }[],
 *   sessions: { id: string, title: string, startTime: string | null, duration: number | null }[] }} p
 * @returns {{ date: string, title: string, blocks: { start: string, end: string, kind: 'busy' | 'free' | 'session', title: string | null, workoutId: string | null }[], allDay: string[] }}
 */
export function dayTimeline({ date, timeZone, events, sessions }) {
  const DAY_START = 6 * 60;
  const DAY_END = 22 * 60;
  const allDay = events.filter((e) => e.allDay).map((e) => e.title);
  /** @type {{ s: number, e: number, kind: 'busy' | 'session', title: string, workoutId: string | null }[]} */
  const taken = [];
  for (const e of events) {
    if (e.allDay) continue;
    const startDay = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(e.start));
    const endDay = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(e.end));
    const s = startDay < date ? 0 : mins(clock(e.start, timeZone));
    const end = endDay > date ? 24 * 60 : mins(clock(e.end, timeZone));
    if (end > s) taken.push({ s, e: end, kind: 'busy', title: e.title, workoutId: null });
  }
  for (const w of sessions) {
    const t = hm(w.startTime);
    if (!t) continue;
    taken.push({ s: mins(t), e: mins(t) + Math.max(15, w.duration ?? 60), kind: 'session', title: w.title, workoutId: w.id });
  }
  taken.sort((a, b) => a.s - b.s || (a.kind === 'session' ? -1 : 1));
  // Merge overlapping meetings; sessions stay their own block.
  /** @type {typeof taken} */
  const merged = [];
  for (const b of taken) {
    const last = merged.at(-1);
    if (last && b.kind === 'busy' && last.kind === 'busy' && b.s < last.e) last.e = Math.max(last.e, b.e);
    else merged.push({ ...b });
  }
  /** @type {ReturnType<typeof dayTimeline>['blocks']} */
  const blocks = [];
  let cursor = DAY_START;
  for (const b of merged) {
    const s = Math.max(b.s, DAY_START);
    const e = Math.min(b.e, DAY_END);
    if (e <= DAY_START || s >= DAY_END) continue;
    if (s - cursor >= 30) blocks.push({ start: at(cursor), end: at(s), kind: 'free', title: null, workoutId: null });
    blocks.push({ start: at(s), end: at(e), kind: b.kind, title: b.title, workoutId: b.workoutId });
    cursor = Math.max(cursor, e);
  }
  if (DAY_END - cursor >= 30) blocks.push({ start: at(cursor), end: at(DAY_END), kind: 'free', title: null, workoutId: null });
  const title = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return { date, title, blocks, allDay };
}
