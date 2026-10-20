// Performance Management Chart math: planned-workout TSS estimates, the fitness/fatigue/form projection
// into the future, and ramp rates. No framework or database imports, so node --test can run it (pmc.test.mjs).
//
// The model matches rebuildTrainingLoad in src/lib/strava-sync/sync.mjs: each day,
// ctl += (tss - ctl) / 42, atl += (tss - atl) / 7, tsb = ctl - atl (same day).

const DAY_MS = 86_400_000;
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Intensity factor (IF) for a planned workout, from its sport, type, intensity text and title.
 * Session averages: an interval day includes warm-up, recoveries and cool-down.
 * @param {{ sport?: string, workoutType?: string | null, intensity?: string | null, title?: string }} w
 */
export function plannedIntensityFactor(w) {
  const sport = String(w.sport ?? '').toLowerCase();
  const t = `${w.workoutType ?? ''} ${w.intensity ?? ''} ${w.title ?? ''}`.toLowerCase();
  if (sport === 'rest' || /\brest\b|off day/.test(t)) return 0;
  if (sport === 'strength' || /strength|lift|barbell|dumbbell/.test(t)) return 0.6;
  if (sport === 'yoga' || /yoga|mobility|stretch/.test(t)) return 0.35;
  if (/\brace\b|time trial|\btt\b/.test(t)) return 0.92;
  if (/threshold|\bz4\b|ftp/.test(t)) return 0.88;
  if (/vo2|\bz5\b|interval|anaerobic|sprint/.test(t)) return 0.85;
  if (/tempo|sweet.?spot|\bz3\b/.test(t)) return 0.8;
  if (/recovery|\bz1\b|shakeout/.test(t)) return 0.55;
  if (sport === 'run') return 0.72;
  if (sport === 'ride') return 0.66;
  if (sport === 'swim') return 0.7;
  if (sport === 'hike' || sport === 'walk') return 0.5;
  return 0.6;
}

/**
 * TSS for a planned workout: the stored TSS when the plan has one, else hours × IF² × 100.
 * Skipped workouts and rest days are 0.
 * @param {{ tss?: number | null, duration?: number | null, status?: string, sport?: string, workoutType?: string | null,
 *           intensity?: string | null, title?: string }} w  duration in minutes
 * @returns {{ tss: number, method: 'planned' | 'estimated' | 'none' }}
 */
export function estimatePlannedTss(w) {
  if (w.status === 'skipped') return { tss: 0, method: 'none' };
  if (typeof w.tss === 'number' && Number.isFinite(w.tss) && w.tss >= 0) return { tss: r1(w.tss), method: 'planned' };
  const min = Number(w.duration ?? 0);
  const IF = plannedIntensityFactor(w);
  if (!(min > 0) || IF === 0) return { tss: 0, method: 'none' };
  return { tss: r1((min / 60) * IF * IF * 100), method: 'estimated' };
}

/**
 * The fitness/fatigue/form series with a projection after today.
 *
 * Days up to and including today come from `history` (daily_training_load). Today counts as projected when
 * it has no actual TSS yet and a workout is planned for it. Days after today use the planned TSS (0 on days
 * with no plan) until `until`. History rows dated after today (the rebuild runs on UTC dates) are replaced.
 *
 * @param {{ date: string, ctl: number, atl: number, tsb?: number, tss: number }[]} history  oldest first
 * @param {{ date: string, tss: number }[]} planned  any order; several per day add up
 * @param {{ today: string, until: string }} opts
 * @returns {{ date: string, ctl: number, atl: number, tsb: number, tss: number, projected: boolean }[]}
 */
export function projectLoad(history, planned, { today, until }) {
  const plannedByDay = new Map();
  for (const p of planned) plannedByDay.set(p.date, (plannedByDay.get(p.date) ?? 0) + Number(p.tss || 0));

  const actual = history.filter((h) => h.date <= today);
  const last = actual.at(-1);
  if (last && last.date === today && !(last.tss > 0) && (plannedByDay.get(today) ?? 0) > 0) actual.pop();

  const out = actual.map((h) => ({
    date: h.date, ctl: h.ctl, atl: h.atl, tsb: h.tsb ?? r1(h.ctl - h.atl), tss: h.tss, projected: false,
  }));
  const seed = out.at(-1);
  let ctl = seed?.ctl ?? 0;
  let atl = seed?.atl ?? 0;
  let d = seed ? addDays(seed.date, 1) : today;
  // A gap between the last actual day and today is filled with zero-TSS days, still actual.
  while (d < today) {
    ctl += (0 - ctl) / 42;
    atl += (0 - atl) / 7;
    out.push({ date: d, ctl: r1(ctl), atl: r1(atl), tsb: r1(ctl - atl), tss: 0, projected: false });
    d = addDays(d, 1);
  }
  for (; d <= until; d = addDays(d, 1)) {
    const tss = d >= today ? (plannedByDay.get(d) ?? 0) : 0;
    ctl += (tss - ctl) / 42;
    atl += (tss - atl) / 7;
    out.push({ date: d, ctl: r1(ctl), atl: r1(atl), tsb: r1(ctl - atl), tss: r1(tss), projected: true });
  }
  return out;
}

/** The projection's end: the last planned day or the next event (at most `maxDays` ahead), and at least `minDays`. */
export function projectionEnd(today, plannedDates, eventDates = [], { minDays = 14, maxDays = 120 } = {}) {
  const cap = addDays(today, maxDays);
  let end = addDays(today, minDays);
  for (const d of [...plannedDates, ...eventDates]) if (d > end && d <= cap) end = d;
  return end;
}

export const RAMP_WINDOWS = [7, 28, 90, 365];

/**
 * Change in fitness (CTL) over the last 7, 28, 90 and 365 days, and the same as a weekly rate.
 * The start point is the row on the start date, or the closest earlier row within 3 days. A window with no
 * start row gets null.
 * @param {{ date: string, ctl: number }[]} load  oldest first
 * @param {string} [asOf]  defaults to the last row's date
 * @returns {({ days: number, from: number, to: number, change: number, perWeek: number } | null)[]}
 */
export function rampRates(load, asOf, windows = RAMP_WINDOWS) {
  const rows = asOf ? load.filter((r) => r.date <= asOf) : load;
  const end = rows.at(-1);
  if (!end) return windows.map(() => null);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return windows.map((days) => {
    const target = addDays(end.date, -days);
    let start = null;
    for (let k = 0; k <= 3 && !start; k++) start = byDate.get(addDays(target, -k)) ?? null;
    if (!start) return null;
    const change = end.ctl - start.ctl;
    return { days, from: r1(start.ctl), to: r1(end.ctl), change: r1(change), perWeek: r1((change / days) * 7) };
  });
}

/** A reading of a weekly CTL ramp: over 8 a week is a high injury risk, 5–8 is aggressive. */
export function rampLevel(perWeek) {
  if (perWeek > 8) return 'high';
  if (perWeek > 5) return 'aggressive';
  if (perWeek >= -2) return 'steady';
  return 'falling';
}
