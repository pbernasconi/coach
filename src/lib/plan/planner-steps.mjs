// @ts-check
// The step-by-step planning screen's sums (web /plan/week and the phone's planner): free windows on the calendar,
// where the hours go, the sessions to keep if the week goes sideways, and this week against last. Pure, so
// node --test can run it.

import { addDays } from './week.mjs';

/** The planning steps, in order. */
export const STEPS = /** @type {const} */ (['last', 'week', 'shape', 'draft', 'accept']);

/** "07:30" → 450. */
const mins = (/** @type {string} */ t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** 450 → "07:30". */
export const hhmm = (/** @type {number} */ m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * The free windows of one day between `from` and `to` (minutes after midnight), at least `min` minutes long, around
 * Paolo's timed calendar events. An all-day event leaves the day as it is (travel shows as a note, not a block).
 * @param {{ date: string, allDay: boolean, start: string | null, minutes: number }[]} calendar
 * @param {string} date
 * @returns {{ start: string, end: string, minutes: number }[]}
 */
export function freeWindows(calendar, date, { from = 6 * 60, to = 21 * 60, min = 60 } = {}) {
  const busy = calendar
    .filter((c) => c.date === date && !c.allDay && c.start)
    .map((c) => [mins(/** @type {string} */ (c.start)), mins(/** @type {string} */ (c.start)) + c.minutes])
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  let at = from;
  for (const [a, b] of busy) {
    if (a - at >= min) out.push([at, Math.min(a, to)]);
    at = Math.max(at, b);
    if (at >= to) break;
  }
  if (to - at >= min) out.push([at, to]);
  return out.filter(([a, b]) => b - a >= min).map(([a, b]) => ({ start: hhmm(a), end: hhmm(b), minutes: b - a }));
}

const TRAVEL = /flight|fly(ing)? to|airport|✈|trip|travel|hotel|conference/i;
const NOT_AWAY = /holiday|birthday|anniversary|day off|ooo|\bday$/i;

/**
 * Days Coach suggests as away, from the calendar: an all-day event (a city, a trip, a hold) or a flight, a trip or
 * a hotel. Public holidays and birthdays are left out. Days before `today` are never suggested.
 * @param {{ date: string, allDay: boolean, title: string }[]} calendar
 * @param {string} monday
 * @param {string} today
 * @returns {string[]}
 */
export function suggestAway(calendar, monday, today) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return week.filter(
    (d) => d >= today && calendar.some((c) => c.date === d && !NOT_AWAY.test(c.title) && (c.allDay || TRAVEL.test(c.title))),
  );
}

/** Physio, stretching and mobility count as physio, whatever their sport. */
const isPhysio = (/** @type {{ title: string }} */ e) => /physio|stretch|mobility/i.test(e.title);

/**
 * Where a week's minutes go, by kind: run, ride, lift, physio, other.
 * @param {{ title: string, sport: string, minutes: number | null }[]} events
 */
export function hourSplit(events) {
  const out = { run: 0, ride: 0, lift: 0, physio: 0, other: 0 };
  for (const e of events) {
    const m = e.minutes ?? 0;
    if (isPhysio(e)) out.physio += m;
    else if (e.sport === 'run') out.run += m;
    else if (e.sport === 'ride') out.ride += m;
    else if (e.sport === 'strength') out.lift += m;
    else out.other += m;
  }
  return out;
}

/**
 * A rough split of `hours` before Coach drafts, from the answers: an hour per lift, 70 min per hard session, the
 * long run, 20 min of physio twice, and the rest easy aerobic.
 * @param {{ hours: number, gym: number, hard: number }} a
 */
export function roughSplit({ hours, gym, hard }) {
  const total = Math.round(hours * 60);
  const lift = gym * 60;
  const quality = hard * 70;
  const long = 105;
  const physio = 40;
  const easy = Math.max(0, total - lift - quality - long - physio);
  return { total, lift, quality, long, physio, easy };
}

/**
 * Up to three sessions to keep if the week goes sideways: the first lift, the first hard session and the longest
 * run (or ride).
 * @template {{ index: number, title: string, sport: string, minutes: number | null, hard: boolean, date: string }} E
 * @param {E[]} events
 * @returns {E[]}
 */
export function keepers(events) {
  const real = [...events].filter((e) => !isPhysio(e)).sort((a, b) => a.date.localeCompare(b.date));
  const lift = real.find((e) => e.sport === 'strength');
  const hard = real.find((e) => e.hard && e !== lift);
  const endurance = real
    .filter((e) => (e.sport === 'run' || e.sport === 'ride') && e !== hard)
    .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0) || Number(b.sport === 'run') - Number(a.sport === 'run'))[0];
  return /** @type {E[]} */ ([lift, hard, endurance].filter(Boolean));
}

/**
 * This week's draft against last week: time, lifts, hard sessions and running.
 * @param {{ ongoing?: boolean, doneMin: number, lifts: { done: number }, hard: { done: number }, runMin?: number } | null} last
 * @param {{ title: string, sport: string, minutes: number | null, hard: boolean }[]} events
 */
export function versusLastWeek(last, events) {
  const split = hourSplit(events);
  const total = events.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const lifts = events.filter((e) => e.sport === 'strength' && !isPhysio(e)).length;
  const hard = events.filter((e) => e.hard).length;
  return [
    { label: 'Time', before: last ? last.doneMin : null, after: total, unit: 'min' },
    { label: 'Lifts', before: last ? last.lifts.done : null, after: lifts, unit: 'n' },
    { label: 'Hard sessions', before: last ? last.hard.done : null, after: hard, unit: 'n' },
    { label: 'Running', before: last?.runMin ?? null, after: split.run, unit: 'min' },
  ];
}

/**
 * What each day is for the week of `monday`: free, off (no training) or away (travel: no gym, runs only), from the
 * answers.
 * @param {string} monday
 * @param {{ daysOff: string[], away?: string[] }} a
 * @returns {{ date: string, mode: 'free' | 'off' | 'away' }[]}
 */
export function dayModes(monday, a) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const mode = a.daysOff.includes(date) ? 'off' : (a.away ?? []).includes(date) ? 'away' : 'free';
    return { date, mode: /** @type {'free' | 'off' | 'away'} */ (mode) };
  });
}

/**
 * The answers with one day set to `mode`: off and away are kept apart and sorted.
 * @template {{ daysOff: string[], away?: string[] }} A
 * @param {A} a
 * @param {string} date
 * @param {'free' | 'off' | 'away'} mode
 * @returns {A}
 */
export function withDayMode(a, date, mode) {
  const daysOff = a.daysOff.filter((d) => d !== date);
  const away = (a.away ?? []).filter((d) => d !== date);
  if (mode === 'off') daysOff.push(date);
  if (mode === 'away') away.push(date);
  return { ...a, daysOff: daysOff.sort(), away: away.sort() };
}

/**
 * The step to open on: the draft while Coach drafts or once there is one, otherwise last week.
 * @param {string | null | undefined} status the proposal's status
 */
export function firstStep(status) {
  return status === 'proposed' || status === 'requested' || status === 'running' ? 'draft' : 'last';
}

/** 75 → "1h15", 40 → "40 min". */
export function hm(/** @type {number} */ min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAD = ['missed', 'skipped'];

/**
 * Coach's read of last week in three short lines: the gym, the hard sessions and the volume against his normal
 * 8–10 h week. Each has a tone (good or warn) and says what the numbers are.
 * @param {{ ongoing?: boolean, doneMin: number, lifts: { planned: number, done: number }, hard: { planned: number, done: number },
 *   days: { date: string, items: { title: string, sport: string, level: string }[], done?: { min: number }[] }[] } | null} lw
 * @param {string} [today] while the week is still going, days from today on aren't counted as empty
 * @param {number} [normalMin] the low end of a normal week
 * @returns {{ id: string, title: string, text: string, tone: 'good' | 'warn' }[]}
 */
export function lastWeekRead(lw, today = '9999-12-31', normalMin = 480) {
  if (!lw) return [];
  const missedLifts = lw.days.flatMap((d) => d.items.filter((i) => i.sport === 'strength' && BAD.includes(i.level) && !/physio|stretch/i.test(i.title)).map((i) => i.title));
  const out = [];
  if (lw.lifts.planned) {
    const short = lw.lifts.done < lw.lifts.planned;
    out.push({
      id: 'lifts',
      title: short ? 'The gym is the gap' : 'Lifts done',
      text: short
        ? `${lw.lifts.done} of ${lw.lifts.planned} lifts.${missedLifts.length ? ` ${[...new Set(missedLifts)].join(' and ')} missed.` : ''}`
        : `All ${lw.lifts.planned} lifts done.`,
      tone: /** @type {'good' | 'warn'} */ (short ? 'warn' : 'good'),
    });
  }
  if (lw.hard.planned) {
    const short = lw.hard.done < lw.hard.planned;
    out.push({
      id: 'hard',
      title: short ? 'A hard session slipped' : 'Hard sessions done',
      text: `${lw.hard.done} of ${lw.hard.planned} hard sessions.`,
      tone: /** @type {'good' | 'warn'} */ (short ? 'warn' : 'good'),
    });
  }
  const empty = lw.days.filter((d) => !(lw.ongoing && d.date >= today) && !(d.done ?? []).some((a) => a.min > 0)).map((d) => DOW[(new Date(`${d.date}T12:00:00Z`).getUTCDay() + 6) % 7]);
  if (lw.ongoing) {
    out.push({ id: 'volume', title: 'Week still going', text: `${hm(lw.doneMin)} so far.${empty.length ? ` Nothing on ${empty.join(', ')}.` : ''}`, tone: /** @type {'good' | 'warn'} */ ('good') });
    return out;
  }
  const short = lw.doneMin < normalMin;
  out.push({
    id: 'volume',
    title: short ? 'Volume ran short' : 'Volume on target',
    text: `${hm(lw.doneMin)} against your 8–10 h week.${short && empty.length && empty.length < 7 ? ` Nothing on ${empty.join(', ')}.` : ''}`,
    tone: /** @type {'good' | 'warn'} */ (short ? 'warn' : 'good'),
  });
  return out;
}
