// @ts-check
// Cards Coach can show in the chat (lift/APP-API.md "Coach", lift/COACH-CHAT.md): a workout, a week, an exercise,
// readiness, a day's timeline, or a breakdown of training time by sport. Claude only names what to show (`show`, kind + ref); the server fills in the real
// data (cards.ts), so a card never carries a number the model made up. `suggest_replies` adds one-tap answers to a
// question; `ask_questions` asks one to five questions as cards (choices, a typed answer, or a confirm). Pure: the
// tool definitions, the checks, the day timeline and the breakdown.

import { addDays, mondayOf } from '../plan/week.mjs';
import { hm } from './changes.mjs';

export const CARD_KINDS = ['workout', 'week', 'exercise', 'readiness', 'day', 'breakdown'];
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
    'can I fit the lift in"). "breakdown": ref = "week:YYYY-MM-DD" (any day of that week) or "month:YYYY-MM", his ' +
    'training time by sport with a bar each ("how much did I train this month", "what did my week look like by ' +
    'sport"). At most 2 cards per answer; only when the card answers better than words.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: CARD_KINDS },
      ref: { type: 'string', description: 'A workout id, a YYYY-MM-DD day, an exercise name, or week:/month: for a breakdown.' },
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
 * @typedef {{ kind: 'workout' | 'week' | 'exercise' | 'readiness' | 'day' | 'breakdown', ref: string }} CardRef
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
  if (k === 'breakdown') {
    const span = breakdownSpan(ref, today);
    return span ? { ok: true, value: { kind: k, ref } } : { ok: false, problems: ['ref for breakdown must be week:YYYY-MM-DD or month:YYYY-MM, up to this week or month'] };
  }
  if (!DATE.test(ref)) return { ok: false, problems: [`ref for ${k} must be YYYY-MM-DD`] };
  if (k === 'readiness' && ref !== today) return { ok: false, problems: [`readiness is for today (${today}) only`] };
  if (ref < addDays(mondayOf(today), -28) || ref > addDays(today, 21)) {
    return { ok: false, problems: [`${ref} is out of range: from 4 weeks back to 3 weeks ahead`] };
  }
  return { ok: true, value: { kind: k, ref } };
}

/**
 * The days a breakdown covers, `to` exclusive and never past tomorrow: a week (Monday on) or a calendar month, up to
 * now and at most a year back. Null for a ref that isn't one.
 * @param {string} ref @param {string} today
 * @returns {{ from: string, to: string, caption: string } | null}
 */
export function breakdownSpan(ref, today) {
  const week = /^week:(\d{4}-\d{2}-\d{2})$/.exec(ref);
  const month = /^month:(\d{4})-(\d{2})$/.exec(ref);
  const yearBack = addDays(today, -366);
  if (week) {
    const from = mondayOf(week[1]);
    if (Number.isNaN(Date.parse(week[1])) || from > today || from < yearBack) return null;
    const label = (/** @type {string} */ d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const caption = from === mondayOf(today) ? 'This week' : `Week of ${label(from)}`;
    return { from, to: minDay(addDays(from, 7), addDays(today, 1)), caption };
  }
  if (month) {
    const m = Number(month[2]);
    if (m < 1 || m > 12) return null;
    const from = `${month[1]}-${month[2]}-01`;
    if (from > today || from < yearBack.slice(0, 8) + '01') return null;
    const next = m === 12 ? `${Number(month[1]) + 1}-01-01` : `${month[1]}-${String(m + 1).padStart(2, '0')}-01`;
    const caption = new Date(`${from}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { from, to: minDay(next, addDays(today, 1)), caption };
  }
  return null;
}

const minDay = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? a : b);

/** "5 h 20 m", "45 m". @param {number} minutes */
export function hoursText(minutes) {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h} h ${m % 60} m` : `${h} h`) : `${m} m`;
}

const SPORT_LABEL = /** @type {Record<string, string>} */ ({
  run: 'Run', ride: 'Ride', swim: 'Swim', strength: 'Strength', walk: 'Walk', hike: 'Hike', yoga: 'Yoga', other: 'Other',
});

/**
 * A breakdown card: training time by sport, biggest first, with the total. Hikes count with walks' colour; yoga
 * with other.
 * @param {{ sport: string, minutes: number }[]} activities  one per activity, sport as sportOfStrava names it
 * @param {string} caption
 * @returns {{ kind: 'breakdown', caption: string, title: string, total: string, unit: string,
 *   rows: { label: string, value: number, display: string, tint: string }[], link: 'plan' }}
 */
export function breakdownCard(activities, caption) {
  /** @type {Map<string, number>} */
  const by = new Map();
  for (const a of activities) {
    if (!(a.minutes > 0)) continue;
    by.set(a.sport, (by.get(a.sport) ?? 0) + a.minutes);
  }
  const total = [...by.values()].reduce((s, v) => s + v, 0);
  const tintOf = (/** @type {string} */ s) => (['run', 'ride', 'swim', 'strength', 'walk'].includes(s) ? s : s === 'hike' ? 'walk' : 'other');
  const rows = [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sport, minutes]) => ({ label: SPORT_LABEL[sport] ?? 'Other', value: Math.round(minutes), display: hoursText(minutes), tint: tintOf(sport) }));
  return { kind: 'breakdown', caption, title: 'Training time', total: hoursText(total), unit: 'by sport', rows, link: 'plan' };
}

/** Questions in one answer. */
export const MAX_QUESTIONS = 5;
const QUESTION_KINDS = ['single', 'multi', 'text', 'confirm'];

export const ASK_TOOL = {
  name: 'ask_questions',
  description:
    'Ask Paolo one to five short questions as cards he answers by tapping, instead of asking in prose, when you need ' +
    'details before you can plan (e.g. which days he travels, what hurts, how long he has). Each question: kind ' +
    '"single" (pick one option), "multi" (pick any; allowOther lets him type another), "text" (he types; give a ' +
    'placeholder), or "confirm" (a yes/no step: confirm.primary is the filled button, confirm.secondary the other; he ' +
    'can always skip). His answers come back as one message, a "title: answer" line per question. Use instead of ' +
    'suggest_replies when there is more than one question or the answer needs choices; keep your text to one line.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'The question, under 60 characters.' },
            subtitle: { type: 'string', description: 'Optional: why you ask, one short line.' },
            kind: { type: 'string', enum: QUESTION_KINDS },
            options: { type: 'array', items: { type: 'string' }, description: 'For single and multi: 2 to 6 options, under 30 characters.' },
            allowOther: { type: 'boolean', description: 'For multi and single: an "Add another…" chip he can type in.' },
            placeholder: { type: 'string', description: 'For text: the hint in the empty field.' },
            confirm: {
              type: 'object',
              properties: { primary: { type: 'string' }, secondary: { type: 'string' } },
              required: ['primary'],
            },
          },
          required: ['title', 'kind'],
        },
      },
    },
    required: ['questions'],
  },
};

/**
 * @typedef {{ id: string, title: string, subtitle: string | null, kind: 'single' | 'multi' | 'text' | 'confirm',
 *   options: string[], allowOther: boolean, placeholder: string | null, confirm: { primary: string, secondary: string | null } | null }} Question
 */

/**
 * An `ask_questions` call, cleaned: bad questions are dropped (a choice without two options, a confirm without its
 * button), texts trimmed, at most five. Ids are q1, q2… in order.
 * @param {any} input @returns {Question[]}
 */
export function cleanQuestions(input) {
  /** @type {unknown[]} */
  const list = Array.isArray(input?.questions) ? input.questions : [];
  const str = (/** @type {unknown} */ v, /** @type {number} */ max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  /** @type {Question[]} */
  const out = [];
  for (const raw of list) {
    const q = /** @type {any} */ (raw ?? {});
    const title = str(q.title, 90);
    const kind = String(q.kind ?? '');
    if (!title || !QUESTION_KINDS.includes(kind)) continue;
    const options = Array.isArray(q.options)
      ? [...new Set(q.options.map((/** @type {unknown} */ o) => str(o, 40)).filter(Boolean))].slice(0, 6)
      : [];
    if ((kind === 'single' || kind === 'multi') && options.length < 2 && !(kind === 'multi' && q.allowOther && options.length)) continue;
    const primary = str(q.confirm?.primary, 30);
    if (kind === 'confirm' && !primary) continue;
    out.push({
      id: `q${out.length + 1}`,
      title,
      subtitle: str(q.subtitle, 140) || null,
      kind: /** @type {Question['kind']} */ (kind),
      options: kind === 'single' || kind === 'multi' ? /** @type {string[]} */ (options) : [],
      allowOther: (kind === 'single' || kind === 'multi') && q.allowOther === true,
      placeholder: kind === 'text' ? str(q.placeholder, 60) || null : null,
      confirm: kind === 'confirm' ? { primary, secondary: str(q.confirm?.secondary, 30) || null } : null,
    });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
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
