// The planning screen for the Lift iPhone app (GET /api/app/plan/week, lift/APP-API.md "Weekly planning"): the
// web's /plan/week data (planner-week.ts) with every label ready to show, and the free slots a session can move to
// (the web's session panel uses freeSlots too). Pure, so node --test runs it (planner-app.test.mjs).

import { addDays } from './week.mjs';
import { freeWindows, keepers, lastWeekRead, suggestAway, upcomingWeeks, versusLastWeek } from './planner-steps.mjs';

/** @param {string} t "HH:MM" */
const minutesOf = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** @param {number} m */
const timeOf = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** @param {string | null | undefined} t "07:05" → "7:05" */
export const clock = (t) => (t ? `${Number(t.slice(0, 2))}:${t.slice(3, 5)}` : '');

/** 75 → "1h15", 40 → "40 min", 0 → "0 min". @param {number | null | undefined} min */
export function hm(min) {
  const m = Math.round(min ?? 0);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`;
}

/** @param {string} d @param {Intl.DateTimeFormatOptions} o */
const fmt = (d, o) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
/** @param {string} d */
export const weekday = (d) => fmt(d, { weekday: 'short' });

/** "Nov 9–15" or "Oct 26 – Nov 1". @param {string} monday */
export function weekLabel(monday) {
  const end = addDays(monday, 6);
  const a = fmt(monday, { month: 'short', day: 'numeric' });
  return monday.slice(5, 7) === end.slice(5, 7) ? `${a}–${Number(end.slice(8))}` : `${a} – ${fmt(end, { month: 'short', day: 'numeric' })}`;
}

/** @param {{ title: string, sport: string }} e */
const isLift = (e) => e.sport === 'strength' && !/physio|stretch/i.test(e.title);

/**
 * Up to `limit` start times the session could move to: this day first, then the rest of the week from today. A slot
 * clashes with no calendar event or other session, keeps one block a day (no split doubles: straight before or after
 * another session) and fits 6:00 to 20:30.
 * @param {{ weekStart: string, today: string, calendar: any[], events: any[] }} data
 * @param {{ index: number, date: string, start: string | null, minutes: number | null }} e
 * @returns {{ date: string, time: string }[]}
 */
export function freeSlots(data, e, limit = 4) {
  const len = e.minutes ?? 60;
  const out = [];
  const week = Array.from({ length: 7 }, (_, i) => addDays(data.weekStart, i));
  const order = [...week].sort((a, b) => Number(b === e.date) - Number(a === e.date));
  for (const d of order) {
    if (d < data.today) continue;
    const others = data.events.filter((x) => x.date === d && x.index !== e.index && x.start);
    const busy = [
      ...data.calendar.filter((c) => c.date === d && !c.allDay && c.start).map((c) => [minutesOf(c.start), minutesOf(c.start) + c.minutes]),
      ...others.map((x) => [minutesOf(x.start), minutesOf(x.start) + (x.minutes ?? 60)]),
    ];
    const candidates = others.length
      ? others.flatMap((x) => [minutesOf(x.start) - len, minutesOf(x.start) + (x.minutes ?? 60)])
      : [6 * 60 + 30, 7 * 60, 12 * 60, 17 * 60, 17 * 60 + 30, 18 * 60];
    for (const s of candidates) {
      if (s < 6 * 60 || s + len > 20 * 60 + 30) continue;
      if (busy.some(([a, b]) => s < b && s + len > a)) continue;
      if (d === e.date && timeOf(s) === e.start) continue;
      out.push({ date: d, time: timeOf(s) });
      break;
    }
    if (out.length >= limit) break;
  }
  return out;
}

const STATE = { requested: 'drafting', running: 'drafting', proposed: 'proposed', failed: 'failed' };
const RANK = ['missed', 'skipped', 'partial', 'off', 'planned', 'today', 'done', 'good'];
/** A day's colour on last week's strip, from its worst session. */
const TONE = { good: 'good', done: 'good', partial: 'warn', off: 'warn', missed: 'bad', skipped: 'bad', today: 'neutral', planned: 'neutral' };

/**
 * The phone's planning screen from loadPlannerWeek's data.
 * @param {any} w PlannerWeek (planner-week.ts)
 */
export function plannerApp(w) {
  const p = w.proposal;
  const state = p ? STATE[/** @type {keyof typeof STATE} */ (p.status)] ?? 'none' : 'none';
  const ready = state === 'proposed';
  const events = ready ? w.events : [];
  const total = events.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const lifts = events.filter(isLift).length;
  const hard = events.filter((e) => e.hard).length;
  const fails = p?.checks?.fails ?? 0;
  const warns = p?.checks?.warns ?? 0;
  const changedTitles = (w.change?.changed ?? []).map((c) => c.what);
  const week = Array.from({ length: 7 }, (_, i) => addDays(w.weekStart, i));
  const lw = w.lastWeek;
  const blocks = w.calendar.filter((c) => c.allDay || c.minutes >= 60);

  return {
    weekStart: w.weekStart,
    today: w.today,
    titleText: `Plan ${weekLabel(w.weekStart)}`,
    weekText: weekLabel(w.weekStart),
    // A week already on the plan with no draft open: what is on it (the phone shows it over step 1).
    onPlanText: state === 'none' && (w.planned ?? []).length
      ? `On your plan: ${w.planned.length} session${w.planned.length === 1 ? '' : 's'}, ${hm(w.planned.reduce((n, e) => n + (e.minutes ?? 0), 0))}.`
      : null,
    // The week picker: this week and the next ones, any of them can be planned.
    weeks: upcomingWeeks(w.today).map((u) => ({ weekStart: u.monday, labelText: u.label, datesText: u.datesText })),
    state,
    proposalId: p && state !== 'none' ? p.id : null,
    version: p?.version ?? null,
    errorText: state === 'failed' ? p.error ?? 'The draft failed.' : null,
    totalsText: ready ? `${hm(total)}${p.request.hours ? ` of ${p.request.hours}h` : ''} · ${lifts} lift${lifts === 1 ? '' : 's'} · ${hard} hard` : null,
    checks: ready && p.checks
      ? { tone: fails ? 'bad' : warns ? 'warn' : 'good', text: fails ? `${fails} check${fails > 1 ? 's' : ''} failed` : warns ? `${warns} to watch` : 'Plan checks pass' }
      : null,
    days: week.map((d) => {
      const own = events.filter((e) => e.date === d);
      const mins = own.reduce((n, e) => n + (e.minutes ?? 0), 0);
      const free = freeWindows(w.calendar, d, { min: 90 });
      return {
        date: d,
        labelText: `${weekday(d)} ${Number(d.slice(8))}`,
        past: d < w.today,
        // Step 2's line under the day: its free windows on the calendar.
        freeText: d < w.today ? 'Done, kept as it was' : free.length ? `Free ${free.map((f) => `${clock(f.start)}–${clock(f.end)}`).join(', ')}` : 'Busy all day',
        off: ready && own.length === 0,
        totalText: ready ? (mins ? hm(mins) : 'Off') : null,
        sessions: own.map((e) => ({
          index: e.index,
          title: e.title,
          sport: e.sport,
          start: e.start,
          minutes: e.minutes,
          timeText: e.start ? clock(e.start) : 'Any time',
          lengthText: e.minutes ? hm(e.minutes) : null,
          tssText: e.tss != null ? `${Math.round(e.tss)} TSS` : null,
          hard: e.hard,
          why: e.why,
          description: e.description,
          changed: changedTitles.some((t) => t.includes(e.title)),
          slots: freeSlots(w, e).map((s) => ({ ...s, text: `${weekday(s.date)} ${clock(s.time)}` })),
        })),
        calendar: w.calendar.filter((c) => c.date === d).map((c) => ({
          title: c.title, allDay: c.allDay, start: c.start, minutes: c.minutes, timeText: c.allDay ? 'All day' : clock(c.start),
        })),
      };
    }),
    change: ready && w.change ? { note: w.change.note, changed: w.change.changed, gaveUp: w.change.gaveUp } : null,
    review: ready ? p.review ?? null : null,
    summary: ready && !p.review ? p.summary ?? null : null,
    issues: ready ? (p.checks?.issues ?? []).map((i) => ({ level: i.level, message: i.message })) : [],
    quickAsks: ready ? ['Make it lighter', 'Swap the hard day', 'Long ride instead of the long run', 'One more easy day'] : [],
    lastWeek: lw
      ? {
          titleText: lw.ongoing ? 'This week so far' : 'How last week went',
          timeText: hm(lw.doneMin),
          timeNote: lw.ongoing ? 'so far' : lw.plannedMin ? `of ${hm(lw.plannedMin)} planned` : null,
          read: lastWeekRead(lw, w.today).map((r) => ({ title: r.title, text: r.text, tone: r.tone })),
          liftsText: `${lw.lifts.done} of ${lw.lifts.planned}`,
          liftsShort: lw.lifts.done < lw.lifts.planned,
          hardText: `${lw.hard.done} of ${lw.hard.planned}`,
          hardShort: lw.hard.done < lw.hard.planned,
          days: lw.days.map((d) => {
            const worst = [...d.items].sort((a, b) => RANK.indexOf(a.level) - RANK.indexOf(b.level))[0];
            const done = (d.done ?? []).map((a) => `${a.name}${a.km ? ` ${a.km} km` : ''} · ${hm(a.min)}`);
            return {
              date: d.date, letter: weekday(d.date).slice(0, 1), labelText: `${weekday(d.date)} ${Number(d.date.slice(8))}`,
              title: worst?.title ?? null, tone: worst ? TONE[worst.level] ?? 'neutral' : 'none',
              doneText: done.length ? done.join('\n') : null,
              missedText: d.items.filter((i) => ['missed', 'skipped'].includes(i.level)).map((i) => `Missed: ${i.title}`).join('\n') || null,
            };
          }),
        }
      : null,
    facts: (w.context?.facts ?? []).filter((f) => f.id !== 'calendar').map((f) => ({ id: f.id, label: f.label, value: f.value, note: f.note ?? null })),
    feels: [
      { id: 'fresh', label: 'Fresh' }, { id: 'normal', label: 'Normal' }, { id: 'fatigued', label: 'Tired' }, { id: 'recovery', label: 'Recovery week' },
    ],
    suggested: {
      feel: w.context?.suggested.feel ?? null,
      feelText: w.context?.suggested.feelWhy ? `Coach reads ${w.context.suggested.feel}: ${w.context.suggested.feelWhy}.` : null,
      hours: w.context?.suggested.hours ?? null,
      hoursText: 'Your normal week is 8–10 h.',
      // Travel days on the calendar, marked away until Paolo changes them (only used before a draft).
      away: suggestAway(w.calendar, w.weekStart, w.today),
    },
    // The answers the open draft was made with, so the Shape controls start where they were.
    answers: p && state !== 'none'
      ? {
          feel: p.request.feel ?? null, hours: p.request.hours ?? null, gym: p.request.gym ?? null, hard: p.request.hard ?? null,
          longDay: p.request.longDay ?? null, daysOff: p.request.daysOff ?? [], away: p.request.away ?? [], lock: p.request.lock ?? '',
        }
      : null,
    longDays: [{ date: week[5], text: 'Sat' }, { date: week[6], text: 'Sun' }],
    planningAround: blocks.slice(0, 10).map((c) => `${weekday(c.date)} ${c.allDay ? '' : `${clock(c.start)} `}${c.title}`),
    syncsTo: ['Google Calendar', 'Lift on iPhone', 'Garmin', 'Zwift'],
    // Step 5: the draft against last week, and the sessions to keep if the week goes sideways.
    versusTitle: lw?.ongoing ? 'Against this week so far' : 'Against last week',
    versus: ready
      ? versusLastWeek(lw, events).map((r) => ({
          label: r.label,
          beforeText: r.before == null ? '–' : r.unit === 'min' ? hm(r.before) : String(r.before),
          afterText: r.unit === 'min' ? hm(r.after) : String(r.after),
        }))
      : [],
    keepers: ready ? keepers(events).map((e) => ({ index: e.index, title: e.title, sport: e.sport, dayText: weekday(e.date) })) : [],
  };
}
