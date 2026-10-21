// @ts-check
// Display text for the Lift pages (/lift, /lift/sessions/[id], /lift/exercises/[key], /lift/weekly) and the Lift
// app's API (/api/app/lift…, lift/APP-API.md). One copy, so the web and the phone show the same words and numbers.
// Pure: no framework imports; node --test (text.test.mjs, app-api.test.mjs).

const DAY_MS = 86_400_000;

// ---- Primitives ----

/**
 * A 'YYYY-MM-DD' day as text ("Oct 20" by default), read at noon UTC so no zone moves it.
 * @param {string} d
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function fmtDay(d, opts = { month: 'short', day: 'numeric' }) {
  const [y, m, n] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, n, 12)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** "Mon, Oct 20, 2026". @param {string} day */
export function formatDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "Oct 20". @param {string} day */
export function formatShortDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "102.5 kg", or "-" for no value. @param {number | null} value @param {string} unit @param {number} [digits] */
export function formatWeight(value, unit, digits = 1) {
  if (value === null) return '-';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${unit}`;
}

/** "12,345 kg". @param {number} value @param {string} unit */
export function formatVolume(value, unit) {
  return `${Math.round(value).toLocaleString('en-US')} ${unit}`;
}

/** "1,235 kg" (whole units). @param {number} v @param {string} unit */
export const weight = (v, unit) => `${Math.round(v).toLocaleString('en-US')} ${unit}`;
/** "12.3k" from 10,000, else "9,876". @param {number} v */
export const compact = (v) => (v >= 10_000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString('en-US'));
/** "12" or "12.5" sets. @param {number} n */
export const fmtSets = (n) => (n % 1 ? n.toFixed(1) : String(n));
/** "quads" → "Quads". @param {string} m */
export const muscleName = (m) => m.charAt(0).toUpperCase() + m.slice(1);
/** "quads" → "Quads", "" stays "". @param {string} m */
export const muscleLabel = (m) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : m);
/** "today", "yesterday", "3 days ago". @param {number} days */
export const ago = (days) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);
/** "102.5" (up to `digits` decimals, grouped). @param {number} v @param {number} [digits] */
export const num = (v, digits = 1) => v.toLocaleString('en-US', { maximumFractionDigits: digits });

/** @typedef {{ reps: number | null, repMin: number | null, repMax: number | null, weight: number | null }} SetTarget */

/** "8", "8–10", or "" for the planned reps. @param {SetTarget} t */
export function repsText(t) {
  if (t.reps != null) return String(t.reps);
  if (t.repMin != null && t.repMax != null) return t.repMin === t.repMax ? String(t.repMin) : `${t.repMin}–${t.repMax}`;
  return '';
}

/**
 * A load as a set shows it: "230 lb", "+25 lb" (added to bodyweight), "BW", or "" with no load.
 * @param {number | null} weight @param {string | null} loadMode @param {string} unit
 */
export function loadText(weight, loadMode, unit) {
  if (loadMode === 'bodyweight') return weight ? `+${num(weight)} ${unit}` : 'BW';
  return weight == null ? '' : `${num(weight)} ${unit}`;
}

/** "each hand", "each side" or "". @param {string | null} loadMode */
export const loadModeNote = (loadMode) => (loadMode === 'perHand' ? 'each hand' : loadMode === 'perSide' ? 'each side' : '');

/** "1:30 rest", "45 s rest", "No rest", or null. @param {number | null} seconds */
export function restText(seconds) {
  if (seconds == null) return null;
  if (seconds === 0) return 'No rest';
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} rest` : `${seconds} s rest`;
}

/** "1 h 5 min", "55 min", or "–". @param {number | null} minutes */
export function durationText(minutes) {
  if (minutes === null) return '–';
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}

/** "RPE 8", "RPE 8.5", or null. @param {number | null | undefined} rpe */
export const rpeText = (rpe) => (typeof rpe === 'number' && Number.isFinite(rpe) ? `RPE ${num(rpe)}` : null);

// ---- /lift overview ----

/**
 * The four stats of the week hero: sets, volume, last lift, streak.
 * @param {{ thisWeek: { sets: number, volume: number }, unit: string, daysSince: number | null, last: { title: string, day: string } | null, streak: number, strengthTarget: number }} o
 * @returns {{ id: string, label: string, value: string, detail: string }[]}
 */
export function weekStats(o) {
  return [
    { id: 'sets', label: 'Sets', value: String(o.thisWeek.sets), detail: 'hard sets this week' },
    { id: 'volume', label: 'Volume', value: `${compact(o.thisWeek.volume)} ${o.unit}`, detail: 'reps × weight' },
    { id: 'last', label: 'Last lift', value: o.daysSince === null ? '–' : ago(o.daysSince), detail: o.last ? `${o.last.title || 'Session'} · ${fmtDay(o.last.day)}` : '' },
    { id: 'streak', label: 'Streak', value: `${o.streak} ${o.streak === 1 ? 'week' : 'weeks'}`, detail: `at ${o.strengthTarget}+ a week` },
  ];
}

/** "today" or "Wed, Oct 22" for the next planned session. @param {string} day @param {string} today */
export const nextWhen = (day, today) => (day === today ? 'today' : fmtDay(day, { weekday: 'short', month: 'short', day: 'numeric' }));

/** "5 exercises · 18 sets planned". @param {{ exercises: number, sets: number }} u */
export const plannedText = (u) => `${u.exercises} exercises · ${u.sets} sets planned`;

/** A main lift's last session ended at most 14 days ago with a new best estimated 1RM. */
export function isNewBest(
  /** @type {{ prDay: string | null, best: { sessionId: string } | null, latest: { sessionId: string } | null }} */ l,
  /** @type {string} */ today
) {
  const recent = l.prDay !== null && Date.parse(`${today}T00:00:00Z`) - Date.parse(`${l.prDay}T00:00:00Z`) <= 14 * DAY_MS;
  return Boolean(recent && l.best && l.latest && l.best.sessionId === l.latest.sessionId);
}

/** "▲ 5% in 12 weeks" / "▼ 3% in 12 weeks", or null. @param {number | null} change */
export const changeText = (change) => (change === null ? null : `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}% in 12 weeks`);

/** "Last 100 kg × 5 · Oct 20". @param {{ weight: number, reps: number, day: string } | null} p @param {string} unit */
export const liftLastText = (p, unit) => `Last ${p ? `${weight(p.weight, unit)} × ${p.reps} · ${fmtDay(p.day)}` : '–'}`;

/**
 * "Best 123 · Oct 20"; "Best 239 · Nov 19 '25" when the best is from another year than `year`.
 * @param {{ e1rm: number, day: string } | null} p @param {string} [year]
 */
export const liftBestText = (p, year) =>
  `Best ${p ? `${Math.round(p.e1rm)} · ${fmtDay(p.day)}${year && p.day.slice(0, 4) !== year ? ` '${p.day.slice(2, 4)}` : ''}` : '–'}`;

export const MUSCLE_BAND = { min: 10, max: 20 };
/** Major muscles the web always lists, even with no sets. */
const ALWAYS = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'];

/**
 * The muscle rows as the page lists them: arms first, then the others that have sets or are major.
 * @template {{ muscle: string, week: number, avg: number, arm: boolean }} R
 * @param {R[]} rows
 */
export function muscleGroups(rows) {
  return {
    arms: rows.filter((r) => r.arm),
    rest: rows.filter((r) => !r.arm && (r.week > 0 || r.avg > 0 || ALWAYS.includes(r.muscle))),
  };
}

/** Against the 10–20 band. @param {number} v @returns {'below' | 'in' | 'above'} */
export const bandStatus = (v) => (v < MUSCLE_BAND.min ? 'below' : v > MUSCLE_BAND.max ? 'above' : 'in');

/** "5 exercises · 18 sets · 52 min". @param {{ exercises: number, sets: number, minutes: number | null }} s */
export const sessionMeta = (s) => [`${s.exercises} exercises`, `${s.sets} sets`, s.minutes ? `${s.minutes} min` : null].filter(Boolean).join(' · ');

/** Heatmap level 0–4 of a day's sets (0: none; 4: 20+). @param {number} sets */
export function heatLevel(sets) {
  if (!sets) return 0;
  return sets >= 20 ? 4 : sets >= 14 ? 3 : sets >= 8 ? 2 : 1;
}

/** "100 kg × 5 · Oct 20" for a record. @param {{ weight: number, reps: number, day: string }} r @param {string} unit */
export const recordText = (r, unit) => `${weight(r.weight, unit)} × ${r.reps} · ${fmtDay(r.day)}`;

/** "+4 kg" over the record before. @param {{ e1rm: number, previous: number }} r @param {string} unit */
export const recordGain = (r, unit) => `+${Math.max(1, Math.round(r.e1rm - r.previous))} ${unit}`;

/** "5 sessions · last Oct 20". @param {{ sessions: number, lastDay: string }} e */
export const exerciseIndexText = (e) => `${e.sessions} sessions · last ${fmtDay(e.lastDay)}`;

// ---- One session ----

/** @typedef {{ kind: string, status: string, reps: number | null, weight: number | null, target: SetTarget }} TextSet */

/**
 * The texts of one set tile: the main line (logged load × reps once done, else the target), the target line, and
 * whether it beat the target weight.
 * @param {TextSet} s @param {string | null} loadMode @param {string} unit
 */
export function setTile(s, loadMode, unit) {
  const reps = repsText(s.target);
  const load = loadText(s.target.weight, loadMode, unit);
  const target = [load, reps && `× ${reps}`].filter(Boolean).join(' ') || '–';
  const done = s.status === 'done';
  const logged = done ? [loadText(s.weight, loadMode, unit), `× ${s.reps ?? '?'}`].filter(Boolean).join(' ') : null;
  const beatTarget = done && s.weight != null && s.target.weight != null && s.weight > s.target.weight;
  return { target, logged, beatTarget };
}

/** The heaviest target load of the working sets, to compare with last time. @param {{ sets: TextSet[] }} e */
export function topTarget(e) {
  const loads = e.sets.filter((s) => s.kind !== 'warmUp' && s.target.weight != null).map((s) => /** @type {number} */ (s.target.weight));
  return loads.length ? Math.max(...loads) : null;
}

/**
 * Today's top target against last time's heaviest set: the difference, or null when either is missing.
 * @param {{ sets: TextSet[], history: { last: { sets: { weight: number | null }[] } | null } }} e
 */
export function lastTimeDelta(e) {
  const top = topTarget(e);
  const lastTop = e.history.last ? Math.max(...e.history.last.sets.map((s) => s.weight ?? 0)) : null;
  return top != null && lastTop ? top - lastTop : null;
}

/** "+2.5 kg vs last" / "−5 kg vs last", or null for no change. @param {number | null} delta @param {string} unit */
export const deltaText = (delta, unit) => (delta == null || delta === 0 ? null : `${delta > 0 ? '+' : '−'}${num(Math.abs(delta))} ${unit} vs last`);

/**
 * The chips of an exercise card: primary and secondary muscles (the library's, else the catalog's), and the equipment.
 * @param {{ primary: string[], secondary: string[], equipment: string | null, media: { target: string | null, secondary: string[], equipment: string | null } | null }} e
 */
export function exerciseChips(e) {
  const media = e.media;
  const equipment = e.equipment ?? media?.equipment ?? null;
  return {
    primary: [...new Set([...(e.primary.length ? e.primary : media?.target ? [media.target] : [])])],
    secondary: e.secondary.length ? e.secondary : (media?.secondary ?? []),
    equipment: equipment ? muscleLabel(String(equipment)) : null,
  };
}

/** Session states as the page labels them. */
export const SESSION_STATE_LABEL = { planned: 'Planned', inProgress: 'In progress', done: 'Done' };

/**
 * The stats of a session's hero.
 * @param {{ exercises: unknown[], setsLogged: number, setsTotal: number, unit: string, volume: number, minutes: number | null }} d
 * @param {number} planned  planned volume
 * @returns {{ id: string, label: string, value: string, detail: string | null }[]}
 */
export function sessionStats(d, planned) {
  return [
    { id: 'exercises', label: 'Exercises', value: String(d.exercises.length), detail: null },
    { id: 'sets', label: 'Sets', value: `${d.setsLogged} / ${d.setsTotal}`, detail: 'logged' },
    { id: 'plannedVolume', label: 'Planned volume', value: planned ? `${num(planned, 0)} ${d.unit}` : '–', detail: null },
    { id: 'volume', label: 'Logged volume', value: `${num(d.volume, 0)} ${d.unit}`, detail: 'warm-ups excluded' },
    { id: 'duration', label: 'Duration', value: durationText(d.minutes), detail: null },
  ];
}

/** "1:32 PM" in `timeZone`, or null. @param {string | null} iso @param {string} timeZone */
export function clockText(iso, timeZone) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}
