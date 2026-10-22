// What Coach knows before it plans a week, for the "Plan with Coach" form: fitness and form, the last four weeks,
// readiness and sleep, how sessions felt, skips, the next events, and the week's calendar. Also the answers it
// suggests from that data. Pure, so node --test can run it (planning-context.test.mjs); planning-context.ts loads it.

import { addDays } from './week.mjs';

const r0 = (n) => Math.round(n);
const sign = (n) => (n > 0 ? `+${r0(n)}` : `${r0(n)}`);
const hours = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}:${String(m).padStart(2, '0')} h` : `${h} h`;
};
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Form (TSB) in words, as the home page's Fitness panel. @param {number} tsb */
export function formWord(tsb) {
  if (tsb > 15) return 'very fresh';
  if (tsb > 5) return 'fresh';
  if (tsb >= -10) return 'neutral';
  if (tsb >= -25) return 'tired';
  return 'very tired';
}

/**
 * @typedef {{ id: string, label: string, value: string, note: string | null, tone: 'good' | 'warn' | 'bad' | 'neutral' }} Fact
 * @typedef {{
 *   load: { date: string, ctl: number, atl: number, tsb: number }[],
 *   weeks: { monday: string, tss: number, min: number, sessions: number }[],
 *   readiness: { status: string, flags: string[], sleep: { totalMin: number, avg7: number | null } | null,
 *     garmin?: { sleepScore?: { value: number } | null, trainingReadiness?: { value: number } | null } } | null,
 *   feedback: { date: string, title: string | null, feel: number | null, rpe: number | null }[],
 *   skips: { date: string, title: string, reason: string | null }[],
 *   events: { name: string, date: string, priority: string, days: number }[],
 *   calendar: { date: string, title: string, allDay: boolean, start: string | null, minutes: number }[],
 *   weekStart: string,
 *   today: string,
 * }} PlanningInput
 */

/**
 * The facts for the form and the suggested answers. A fact with no data is left out.
 * @param {PlanningInput} x
 */
export function planningContext(x) {
  /** @type {Fact[]} */
  const facts = [];
  const last = x.load.at(-1) ?? null;
  const weekAgo = last ? x.load.filter((l) => l.date <= addDays(last.date, -7)).at(-1) : null;

  if (last) {
    const change = weekAgo ? last.ctl - weekAgo.ctl : null;
    facts.push({
      id: 'fitness',
      label: 'Fitness',
      value: `${r0(last.ctl)} CTL`,
      note: change == null ? null : Math.round(change) === 0 ? 'steady over 7 days' : `${sign(change)} in 7 days`,
      tone: change == null ? 'neutral' : change < -1 ? 'warn' : change > 8 ? 'warn' : 'good',
    });
    facts.push({
      id: 'form',
      label: 'Form',
      value: sign(last.tsb),
      note: formWord(last.tsb),
      tone: last.tsb < -25 ? 'bad' : last.tsb < -10 ? 'warn' : 'good',
    });
  }

  const full = x.weeks.filter((w) => w.monday < addDays(x.today, -((new Date(`${x.today}T12:00:00Z`).getUTCDay() + 6) % 7)));
  const avgMin = avg(full.map((w) => w.min));
  const avgTss = avg(full.map((w) => w.tss));
  if (full.length && avgMin != null && avgTss != null) {
    facts.push({
      id: 'volume',
      label: `Last ${full.length} weeks`,
      value: avgMin > 0 ? `${hours(avgMin)} / wk` : `${r0(avgTss)} TSS / wk`,
      note: avgMin > 0 ? `${r0(avgTss)} TSS · ${r0(avg(full.map((w) => w.sessions)) ?? 0)} sessions` : null,
      tone: 'neutral',
    });
  }

  const rd = x.readiness;
  if (rd && rd.status !== 'unknown') {
    const parts = [];
    const tr = rd.garmin?.trainingReadiness?.value;
    const ss = rd.garmin?.sleepScore?.value;
    if (rd.sleep) parts.push(`sleep ${hours(rd.sleep.totalMin)}`);
    if (ss != null) parts.push(`score ${r0(ss)}`);
    facts.push({
      id: 'readiness',
      label: 'Readiness',
      value: tr != null ? `${r0(tr)}` : rd.status === 'good' ? 'Good' : rd.status === 'ok' ? 'OK' : 'Low',
      note: parts.join(' · ') || (rd.flags[0] ?? null),
      tone: rd.status === 'good' ? 'good' : rd.status === 'ok' ? 'warn' : 'bad',
    });
  }

  const felt = x.feedback.filter((f) => f.feel != null || f.rpe != null);
  if (felt.length) {
    const feel = avg(felt.filter((f) => f.feel != null).map((f) => /** @type {number} */ (f.feel)));
    const rpe = avg(felt.filter((f) => f.rpe != null).map((f) => /** @type {number} */ (f.rpe)));
    const value = feel != null ? ['Very weak', 'Weak', 'Normal', 'Strong', 'Very strong'][Math.round(feel) - 1] : `RPE ${rpe?.toFixed(1)}`;
    facts.push({
      id: 'feel',
      label: 'Sessions felt',
      value,
      note: [rpe != null && feel != null ? `RPE ${rpe.toFixed(1)}` : null, `${felt.length} logged, 14 d`].filter(Boolean).join(' · '),
      tone: feel != null && feel < 2.5 ? 'warn' : 'neutral',
    });
  }

  if (x.skips.length) {
    const reasons = [...new Set(x.skips.map((s) => s.reason).filter(Boolean))];
    facts.push({
      id: 'skips',
      label: 'Skipped',
      value: `${x.skips.length} in 14 d`,
      note: reasons.length ? reasons.join(', ') : null,
      tone: x.skips.length >= 3 ? 'bad' : 'warn',
    });
  }

  const next = x.events[0];
  if (next) {
    facts.push({
      id: 'event',
      label: next.priority === 'A' ? 'Next A race' : 'Next event',
      value: next.name,
      note: next.days === 0 ? 'today' : next.days === 1 ? 'tomorrow' : `in ${next.days} days`,
      tone: next.days <= 14 ? 'warn' : 'neutral',
    });
  }

  const weekEnd = addDays(x.weekStart, 6);
  const inWeek = x.calendar.filter((c) => c.date >= x.weekStart && c.date <= weekEnd);
  const busyMin = inWeek.filter((c) => !c.allDay).reduce((n, c) => n + c.minutes, 0);
  const allDay = inWeek.filter((c) => c.allDay);
  if (inWeek.length) {
    const named = allDay.length ? allDay : inWeek.filter((c) => c.minutes >= 90);
    facts.push({
      id: 'calendar',
      label: 'Calendar',
      value: named.length ? named.slice(0, 2).map((c) => `${DOW[dayIndex(x.weekStart, c.date)]} ${c.title}`).join(', ') : `${inWeek.length} events`,
      note: busyMin ? `${hours(busyMin)} booked` : null,
      tone: allDay.length ? 'warn' : 'neutral',
    });
  }

  /** @type {Record<string, string>} what is on each day's calendar, for the day picker */
  const days = {};
  for (const c of inWeek) {
    const text = c.allDay ? c.title : `${c.start ?? ''} ${c.title}`.trim();
    days[c.date] = days[c.date] ? `${days[c.date]} · ${text}` : text;
  }
  return { facts, days, suggested: suggest(x, { last, avgMin }) };
}

/** 0 for Monday … 6 for Sunday. */
function dayIndex(weekStart, date) {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${weekStart}T12:00:00Z`)) / 864e5);
}

/** The answers the data points to; Paolo can change each. */
function suggest(x, { last, avgMin }) {
  const felt = x.feedback.filter((f) => f.feel != null);
  const feelAvg = avg(felt.map((f) => /** @type {number} */ (f.feel)));
  const tiredSkips = x.skips.filter((s) => ['tired', 'sick', 'sore'].includes(String(s.reason))).length;
  const low = x.readiness?.status === 'low';
  let feel = 'normal';
  const why = [];
  if (last && last.tsb < -25) {
    feel = 'recovery';
    why.push(`form ${sign(last.tsb)}`);
  } else if ((last && last.tsb < -15) || low || tiredSkips >= 2 || (feelAvg != null && feelAvg < 2.5)) {
    feel = 'fatigued';
    if (last && last.tsb < -15) why.push(`form ${sign(last.tsb)}`);
    if (low) why.push('low readiness');
    if (tiredSkips >= 2) why.push(`${tiredSkips} tired skips`);
    if (feelAvg != null && feelAvg < 2.5) why.push('sessions felt weak');
  } else if (last && last.tsb > 5 && x.readiness?.status === 'good') {
    feel = 'fresh';
    why.push(`form ${sign(last.tsb)}`, 'readiness good');
  }
  const h = avgMin ? Math.min(14, Math.max(3, Math.round(avgMin / 60))) : null;
  return { feel, feelWhy: why.join(', ') || null, hours: h };
}
