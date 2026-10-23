// Display text and tones for Today (src/app/(dashboard)/page.tsx) and Trends (trends/page.tsx). The web pages and
// the app API (lift/APP-API.md: /api/app/today, /api/app/trends) both use these, so the phone shows the web's
// text. Pure: no framework or database imports; node --test (display.test.mjs).

import { rampLevel } from './pmc.mjs';
import { zoneOf } from './form.mjs';
import { formatDuration, formatPace } from './peaks.mjs';
import { MUSCLE_TARGET } from '../lift-dashboard/stats.mjs';
import { hrvStatusLabel } from '../vitals/garmin-training.mjs';
import { STATUS_TEXT, formatValue } from '../goals/goals.mjs';
import { dur } from '../plan/cells.mjs';

/** @typedef {'good' | 'warn' | 'bad' | 'neutral'} Tone */

const pad2 = (n) => String(n).padStart(2, '0');

/** Hours as "h:mm" ("5:30"). */
export function hoursText(h) {
  const m = Math.max(0, Math.round((Number(h) || 0) * 60));
  return `${Math.floor(m / 60)}:${pad2(m % 60)}`;
}

/** Minutes as "h:mm" ("7:05"). */
export function minutesText(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(m / 60)}:${pad2(m % 60)}`;
}

/** A whole number with its sign: "+5", "-12", "0". */
export const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n) || 0}`;

/** One decimal with its sign: "+1.5", "-0.4". */
export const signed1 = (n) => (Math.abs(n) < 0.05 ? '0.0' : `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`);

/** Pace per km as "m:ss" for minutes over km, or null without km. */
export function paceText(min, km) {
  if (!km) return null;
  const s = Math.round((min * 60) / km);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** "Oct 19" for a 'YYYY-MM-DD' day. */
export const shortDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Oct 19, 25" for a 'YYYY-MM-DD' day (the peak table). */
export const shortDateYear = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' });

/** "Tuesday, October 20" for a 'YYYY-MM-DD' day (the Today header). */
export const longDate = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

// ---- Today: header chips ----

const READINESS = [[95, 'Prime'], [75, 'High'], [50, 'Moderate'], [25, 'Low'], [0, 'Poor']];
/** Garmin's readiness band: "Prime", "High", "Moderate", "Low", "Poor". */
export const readinessBand = (v) => READINESS.find(([min]) => v >= min)?.[1] ?? '';

/**
 * The Today header chips, in the web's order: readiness, sleep, HRV status, fitness / fatigue, form. A chip is left
 * out when its value is missing.
 * @param {{ readiness?: { value: number } | null, sleepMin?: { value: number } | null, sleepScore?: { value: number } | null, hrvStatus?: { value: number } | null } | null} recovery
 *   loadRecoveryToday, or null when it has no data in the last 7 days
 * @param {{ ctl: number, atl: number, tsb: number } | null} load  the last actual PMC day
 * @returns {{ key: string, label: string, value: number | string, valueText: string, tone: Tone }[]}
 */
export function headerChips(recovery, load) {
  const r = recovery;
  const chips = [];
  if (r?.readiness) {
    const v = r.readiness.value;
    chips.push({ key: 'readiness', label: 'Readiness', value: Math.round(v), valueText: `${Math.round(v)} · ${readinessBand(v)}`, tone: v < 25 ? 'bad' : v < 50 ? 'warn' : 'good' });
  }
  if (r?.sleepMin) {
    const s = r.sleepScore?.value;
    chips.push({ key: 'sleep', label: 'Sleep', value: Math.round(r.sleepMin.value), valueText: minutesText(r.sleepMin.value), tone: s == null ? 'neutral' : s < 60 ? 'bad' : s < 80 ? 'warn' : 'good' });
  }
  const hrv = hrvStatusLabel(r?.hrvStatus?.value ?? null);
  if (hrv) chips.push({ key: 'hrv', label: 'HRV', value: hrv, valueText: hrv, tone: hrv === 'Balanced' ? 'good' : hrv === 'Unbalanced' ? 'warn' : 'bad' });
  if (load) {
    chips.push({ key: 'fitness', label: 'Fit / Fat', value: Math.round(load.ctl), valueText: `${Math.round(load.ctl)} / ${Math.round(load.atl)}`, tone: 'neutral' });
    chips.push({ key: 'form', label: 'Form', value: Math.round(load.tsb), valueText: signed(load.tsb), tone: load.tsb < -30 ? 'bad' : load.tsb < -10 ? 'warn' : 'good' });
  }
  return chips;
}

/** The banner when the newest Strava activity is more than 7 days old, else null. */
export function staleText(latestActivity, today) {
  if (!latestActivity) return null;
  const days = Math.round((Date.parse(today) - Date.parse(latestActivity)) / 864e5);
  return days > 7 ? `The newest Strava activity is from ${latestActivity}.` : null;
}

// ---- Fitness chart ----

/** The line under the fitness chart, or null when there is no projection. */
export function projectionCaption(pmc) {
  const end = pmc.days.filter((d) => d.projected).at(-1);
  if (!end) return null;
  const planned = pmc.plannedTss ? `${pmc.plannedTss} planned TSS` : 'no workouts planned, so it shows rest';
  const est = pmc.estimatedWorkouts > 0
    ? ` ${pmc.estimatedWorkouts} planned ${pmc.estimatedWorkouts === 1 ? 'workout has' : 'workouts have'} no TSS; estimated from duration and intensity.`
    : '';
  return `Projection to ${end.date}: ${planned}, fitness ${Math.round(end.ctl)}, form ${end.tsb > 0 ? '+' : ''}${Math.round(end.tsb)}.${est}`;
}

// ---- Weeks (Today's last 4 weeks, Trends' tiles and table) ----

const sum = (ws, key) => ws.reduce((n, w) => n + Number(w[key]), 0);

/** Complete weeks before `currentWeek` (Monday): the last 4, and the 4 before those. */
export function lastWeeks(weeks, currentWeek) {
  const complete = weeks.filter((w) => w.week !== currentWeek);
  return { last4: complete.slice(-4), prev4: complete.slice(-8, -4) };
}

/**
 * Today's "Last 4 weeks" tiles. `sport`: the tile's color (a design/sports.json id), null for the ink color.
 * @returns {{ key: string, label: string, valueText: string, noteText: string, sport: string | null }[]}
 */
export function last4Tiles(last4, strengthTarget) {
  const hours = sum(last4, 'hours');
  return [
    { key: 'time', label: 'Time · 4 weeks', valueText: `${hoursText(hours)} h`, noteText: `${(hours / 4).toFixed(1)} h a week`, sport: null },
    { key: 'run', label: 'Run', valueText: `${Math.round(sum(last4, 'runKm'))} km`, noteText: paceText(sum(last4, 'runMin'), sum(last4, 'runKm')) ? `${paceText(sum(last4, 'runMin'), sum(last4, 'runKm'))} /km` : 'no runs', sport: 'run' },
    { key: 'ride', label: 'Ride', valueText: `${Math.round(sum(last4, 'rideKm'))} km`, noteText: `${hoursText(sum(last4, 'rideHours'))} h`, sport: 'ride' },
    { key: 'strength', label: 'Strength', valueText: `${sum(last4, 'strength')} of ${strengthTarget * 4}`, noteText: 'sessions', sport: 'strength' },
  ];
}

/** The change from `before` to `now` in percent, as "▲ 12%" / "▼ 3%"; null when `before` is 0. */
export function delta(now, before) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return { pct, up, text: `${up ? '▲' : '▼'} ${Math.abs(pct)}%` };
}

/**
 * The 4 Trends tiles: hours, run, ride, form. `delta` for hours and ride ("vs the 4 weeks before"), else `foot`.
 * `spark`: 12 values oldest first, with a label and a display text each.
 * @param {{ weeks: object[], load: { date: string, ctl: number, tsb: number }[] }} perf  loadPerformance
 */
export function performanceTiles(perf, currentWeek, strengthTarget) {
  const weeks = perf.weeks;
  const { last4, prev4 } = lastWeeks(weeks, currentWeek);
  const labels = weeks.map((w) => `Week of ${shortDate(w.week)}`);
  const lastLoad = perf.load.at(-1);
  const weeklyLoad = perf.load.filter((_, i) => i % 7 === 6 || i === perf.load.length - 1);
  const runPace = paceText(sum(last4, 'runMin'), sum(last4, 'runKm'));
  return [
    {
      key: 'hours', label: 'Hours, last 4 weeks', valueText: hoursText(sum(last4, 'hours')),
      delta: delta(sum(last4, 'hours'), sum(prev4, 'hours')), foot: 'Moving time',
      spark: { values: weeks.map((w) => w.hours), labels, texts: weeks.map((w) => `${hoursText(w.hours)} h`) }, sport: null,
    },
    {
      key: 'run', label: 'Run, last 4 weeks', valueText: `${Math.round(sum(last4, 'runKm'))} km`,
      delta: null, foot: `Pace ${runPace ? `${runPace}/km` : '-'}`,
      spark: { values: weeks.map((w) => w.runKm), labels, texts: weeks.map((w) => `${w.runKm.toFixed(1)} km`) }, sport: 'run',
    },
    {
      key: 'ride', label: 'Ride, last 4 weeks', valueText: `${hoursText(sum(last4, 'rideHours'))} h`,
      delta: delta(sum(last4, 'rideHours'), sum(prev4, 'rideHours')), foot: 'Moving time',
      spark: { values: weeks.map((w) => w.rideHours), labels, texts: weeks.map((w) => `${hoursText(w.rideHours)} h`) }, sport: 'ride',
    },
    {
      key: 'form', label: 'Form today', valueText: lastLoad ? signed(lastLoad.tsb) : '-',
      delta: null,
      foot: `${lastLoad ? `${zoneOf(lastLoad.tsb)} · fitness ${Math.round(lastLoad.ctl)}` : 'No load data'} · strength ${sum(last4, 'strength')}/${strengthTarget * 4}`,
      spark: { values: weeklyLoad.map((p) => p.ctl), labels: weeklyLoad.map((p) => p.date), texts: weeklyLoad.map((p) => `fitness ${Math.round(p.ctl)}`) }, sport: null,
    },
  ];
}

/** One row of the Trends table "every week". */
export function weekRow(w, currentWeek) {
  const p = paceText(w.runMin, w.runKm);
  return {
    week: w.week,
    current: w.week === currentWeek,
    label: `${shortDate(w.week)}${w.week === currentWeek ? ' (this week)' : ''}`,
    hoursText: hoursText(w.hours),
    runKmText: w.runKm ? w.runKm.toFixed(1) : '-',
    runPaceText: p ? `${p}/km` : '-',
    rideKmText: w.rideKm ? w.rideKm.toFixed(0) : '-',
    strengthText: w.strength ? String(w.strength) : '-',
    tssText: w.tss ? String(Math.round(w.tss)) : '-',
    planText: w.planned ? `${w.done}/${w.planned}` : '-',
  };
}

// ---- Weekly hours chart ----

const hoursOf = (w, id) => w.sports?.[id]?.hours ?? 0;

/**
 * The stacked weekly hours: the sports with hours in the window (in `sports` order, without rest), each week's
 * total, and the average of the complete weeks.
 * @param {{ week: string, sports: Record<string, { hours: number }>, strength: number, tss: number }[]} weeks
 * @param {{ id: string, label: string }[]} sports  design/sports.json order
 */
export function hoursSeries(weeks, currentWeek, sports) {
  const series = sports.filter((s) => s.id !== 'rest' && weeks.some((w) => hoursOf(w, s.id) > 0));
  const total = (w) => series.reduce((n, s) => n + hoursOf(w, s.id), 0);
  const complete = weeks.filter((w) => w.week !== currentWeek);
  const average = complete.length ? complete.reduce((n, w) => n + total(w), 0) / complete.length : 0;
  return { series, total, average };
}

/** The chart tooltip's text for one sport: its exact Strava types where they differ from the sport ("Hike",
 * "Virtual ride"), and km. */
export function sportDetail(s, sw) {
  const types = Object.entries(sw.types ?? {}).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const named = types.filter((t) => t !== s.label);
  const parts = [named.length || s.id === 'other' ? types.join(', ') : s.label];
  if (sw.km >= 0.5 && s.id !== 'strength') parts.push(s.id === 'ride' ? `${Math.round(sw.km)} km` : `${sw.km.toFixed(1)} km`);
  return parts.join(' · ');
}

// ---- Ramp rates ----

export const RAMP_LABEL = { 7: '7 days', 28: '28 days', 90: '90 days', 365: '1 year' };
export const RAMP_LEVEL = { high: 'High', aggressive: 'Aggressive', steady: 'Steady', falling: 'Falling' };
export const RAMP_NOTE = 'CTL points. Over +8 a week is a high injury risk; +5 to +8 is aggressive.';

/** One ramp-rate cell. `warn`: high or aggressive (the web adds ▲ and the down color). */
export function rampCell(r, k) {
  const days = r?.days ?? [7, 28, 90, 365][k];
  const label = RAMP_LABEL[days] ?? `${days} days`;
  if (!r) return { days, label, change: null, changeText: '–', perWeek: null, perWeekText: null, level: null, levelText: 'Not enough data', warn: false };
  const level = rampLevel(r.perWeek);
  return {
    days, label, change: r.change, changeText: signed1(r.change), perWeek: r.perWeek, perWeekText: `${signed1(r.perWeek)}/wk`,
    level, levelText: RAMP_LEVEL[level], warn: level === 'high' || level === 'aggressive',
  };
}

// ---- Peak performances ----

/** A peak value as text: watts for power; time plus pace for a run distance in meters. */
export function peakText(metric, meters, v) {
  // Over 1 km the pace is the time, so it is left out.
  return metric === 'power' ? { main: `${Math.round(v)} W`, sub: null } : { main: formatDuration(v), sub: meters === 1000 ? null : formatPace(meters, v) };
}

// ---- Lift ----

export { MUSCLE_TARGET };

/** Hard sets, to the half set: "12", "7.5". */
export const setsText = (n) => {
  const v = Math.round(n * 2) / 2;
  return v % 1 ? v.toFixed(1) : String(v);
};

/** A whole number as is, else one decimal: "12", "3.4" (the Trends muscle chart). */
export const decimalText = (n) => (n % 1 ? n.toFixed(1) : String(n));

/** "Upper back" for a muscle id like "upperBack". */
export const muscleLabel = (m) => m.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** A muscle's sets against the 10–20 band. */
export const muscleStatusText = (sets) => (sets < MUSCLE_TARGET.min ? 'below target' : sets > MUSCLE_TARGET.max ? 'above target' : 'in target');

/**
 * The Trends muscle rows: this week against the average of the 4 weeks before, the top 10 by that average.
 * @param {{ muscle: string, sets: number }[]} thisWeek
 * @param {{ muscle: string, sets: number }[]} last4  muscleSets over the 4 weeks before this one
 */
export function muscleRows(thisWeek, last4) {
  const avg = new Map(last4.map((m) => [m.muscle, m.sets / 4]));
  return [...new Set([...thisWeek.map((m) => m.muscle), ...last4.map((m) => m.muscle)])]
    .map((muscle) => ({ muscle, week: thisWeek.find((m) => m.muscle === muscle)?.sets ?? 0, avg: avg.get(muscle) ?? 0 }))
    .sort((a, b) => b.avg - a.avg || b.week - a.week)
    .slice(0, 10);
}

/** A main lift's 12-week change: "+5%", "-2%", "" when unknown. */
export const liftChangeText = (change) => (change == null ? '' : `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`);

/** A main lift's estimated 1RM: "100 kg", or "–". */
export const e1rmText = (latest, unit, none = '–') => (latest ? `${Math.round(latest)} ${unit}` : none);

/** "Today", "Yesterday", "5 days ago". */
export const daysAgoText = (n) => (n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`);

/** The weight's 4-week change: "▼ 1.2 kg" (good) or "▲ 0.4 kg" (bad), and "-0.30 kg a week". */
export function weightChange(change) {
  if (change == null) return null;
  return { text: `${change <= 0 ? '▼' : '▲'} ${Math.abs(change).toFixed(1)} kg`, tone: change <= 0 ? 'good' : 'bad', perWeekText: `${(change / 4).toFixed(2)} kg a week` };
}

// ---- Goals ----

/**
 * A goal for display: status, values and time left as the web's Goals card.
 * @param {import('../goals/goals.mjs').GoalProgress} g
 */
export function goalView(g) {
  const closed = g.status === 'done' || g.status === 'missed';
  return {
    id: g.id,
    kind: g.kind,
    title: g.title,
    status: g.status,
    statusText: STATUS_TEXT[g.status],
    current: g.current == null ? null : Math.round(g.current * 100) / 100,
    currentText: formatValue(g.kind, g.current),
    target: g.target,
    targetText: formatValue(g.kind, g.target),
    deadline: g.deadline,
    daysLeft: closed ? null : g.daysLeft,
    timeText: closed ? `by ${g.deadline}` : `${g.daysLeft} days left · ${g.deadline}`,
    progress: Math.round(g.progress * 100) / 100,
    detail: g.detail,
  };
}

// ---- Today line (above the week on Today) ----

/**
 * Today's planned workouts that are not skipped, and the line's text when there are none.
 * @template {{ date: string, status: string }} W
 * @param {{ today: string, workouts: W[] }} range  loadRange (month.ts)
 * @returns {{ items: W[], emptyText: string | null }}
 */
export function todayWorkouts(range) {
  const items = range.workouts.filter((w) => w.date === range.today && w.status !== 'skipped');
  const emptyText = items.length ? null : range.workouts.length ? 'Rest day' : 'No plan this week. Run /plan in Claude Code to make one.';
  return { items, emptyText };
}

/** A workout on the Today line: "13:30 · 1:00 · done". */
export const todayItemText = (w) => [w.startTime, w.duration ? dur(w.duration) : null].filter(Boolean).join(' · ') + (w.state === 'done' ? ' · done' : '');

/**
 * A done workout on the Today card: its status (as the Plan calendar colours it), what was done next to what was
 * planned, and where the activity opens. Null when it is not done.
 * @param {{ state?: string, duration?: number | null, tss?: number | null, compliance?: { level: string, label: string } | null,
 *   actual?: { min?: number | null, tss?: number | null, km?: number | null } | null,
 *   match?: { source: string, id: string, name: string, activityId?: string | null } | null }} w
 * @param {number | null} [plannedTss]  the planned TSS when the workout has none of its own (from its steps)
 */
export function todayDone(w, plannedTss = null) {
  if (w.state !== 'done') return null;
  const a = w.actual ?? {};
  const tssP = w.tss ? Math.round(w.tss) : plannedTss ? Math.round(plannedTss) : null;
  const doneText = [a.min ? dur(a.min) : null, a.km ? `${a.km.toFixed(1)} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
  const plannedText = [w.duration ? dur(w.duration) : null, tssP ? `${tssP} TSS` : null].filter(Boolean).join(' · ');
  const m = w.match ?? null;
  const stravaId = m ? (m.source === 'strava' ? m.id : m.activityId ?? null) : null;
  const href = m?.source === 'lift' ? `/lift/sessions/${m.id}` : stravaId ? `/activities/${stravaId}` : null;
  return {
    level: w.compliance?.level ?? 'done',
    label: w.compliance?.label ?? 'Done',
    doneText: doneText || null,
    plannedText: plannedText || null,
    href,
    name: m?.name || null,
  };
}

// ---- Today: the Fitness panel (right column) ----

/** What each form zone means for training, in plain words. Keys: FORM_ZONES labels (form.mjs). */
const FORM_MEANING = {
  Fresh: 'rested, good for a race or a hard day',
  Neutral: 'balanced, holding fitness',
  Productive: 'tired in a good way, building fitness',
  Overreaching: 'very tired, ease off soon',
};

/**
 * The three tiles at the top of the Fitness panel: fatigue (ATL), fitness (CTL) and form (TSB), with form's zone
 * and what it means. Null without a PMC day.
 * @param {{ ctl: number, atl: number, tsb: number } | null} load  the last actual PMC day
 */
export function loadTiles(load) {
  if (!load) return null;
  const zone = zoneOf(load.tsb);
  return [
    { key: 'fatigue', label: 'Fatigue', valueText: String(Math.round(load.atl)), zone: null, meaning: null },
    { key: 'fitness', label: 'Fitness', valueText: String(Math.round(load.ctl)), zone: null, meaning: null },
    { key: 'form', label: 'Form', valueText: signed(load.tsb).replace('-', '\u2212'), zone: zone || null, meaning: FORM_MEANING[zone] ?? null },
  ];
}

/**
 * The "Recovery today" rows (the header chips before 2026-10-21): readiness, HRV status and sleep from Garmin,
 * each with a plain-language line on what it means. A row is left out when its value is missing.
 * @param {{ readiness?: { value: number } | null, sleepMin?: { value: number } | null, sleepScore?: { value: number } | null, hrvStatus?: { value: number } | null } | null} recovery
 * @returns {{ key: string, label: string, valueText: string, tone: Tone, note: string }[]}
 */
export function recoveryRows(recovery) {
  const r = recovery;
  const rows = [];
  if (r?.readiness) {
    const v = Math.round(r.readiness.value);
    rows.push({
      key: 'readiness', label: 'Readiness', valueText: `${v} · ${readinessBand(v)}`,
      tone: v < 25 ? 'bad' : v < 50 ? 'warn' : 'good',
      note: "Garmin's 0–100 score for training today.",
    });
  }
  const hrv = hrvStatusLabel(r?.hrvStatus?.value ?? null);
  if (hrv && hrv !== 'No status') {
    const note = hrv === 'Balanced'
      ? 'Overnight heart rate variability is in your normal range: recovering well.'
      : hrv === 'Unbalanced'
        ? 'Overnight heart rate variability is outside your normal range: stress or fatigue.'
        : 'Overnight heart rate variability is well below normal: recovery is lagging.';
    rows.push({ key: 'hrv', label: 'HRV', valueText: hrv, tone: hrv === 'Balanced' ? 'good' : hrv === 'Unbalanced' ? 'warn' : 'bad', note });
  }
  if (r?.sleepMin) {
    const s = r.sleepScore?.value;
    rows.push({
      key: 'sleep', label: 'Sleep', valueText: minutesText(r.sleepMin.value) + (s == null ? '' : ` · ${Math.round(s)}`),
      tone: s == null ? 'neutral' : s < 60 ? 'bad' : s < 80 ? 'warn' : 'good',
      note: s == null ? 'Time asleep last night.' : 'Time asleep last night, and Garmin’s sleep score (out of 100).',
    });
  }
  return rows;
}

/**
 * Ramp-rate cells for the panel's mini charts: "Last 7 days" and so on, with the change in whole CTL points.
 * @param {({ days: number, from: number, to: number, change: number, perWeek: number } | null)[]} ramp
 */
export function rampTiles(ramp) {
  return ramp.map((r, k) => {
    const c = rampCell(r, k);
    // A true minus sign: a hyphen is narrower than the digits.
    return { ...c, title: `Last ${c.days} days`, changeText: r ? signed(r.change).replace('-', '\u2212') : '–' };
  });
}
