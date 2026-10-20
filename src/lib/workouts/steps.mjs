// Structured workouts: a planned workout as steps (warm-up, work, recovery, repeats) with targets. The steps are
// the source for the chart in Coach, the planned time and TSS, and the copies on the devices (intervals.icu sends
// them to Zwift and to the Garmin watch; docs/research/structured-workouts.md).
//
// Targets are relative to the athlete's anchors, so a new FTP or LTHR changes the watts and beats without new
// workouts: rides in % of FTP, runs in % of LTHR (PLAN-STRUCTURE: heart rate for all but Z5). Pure; node --test.

/** Paolo's anchors (plans/PLAN-STRUCTURE.md). */
export const ANCHORS = { ftp: 280, lthr: 168, maxHr: 182 };

/**
 * Coach zones as ranges of the anchors. Power in % of FTP, heart rate in % of LTHR. From the zone table in
 * PLAN-STRUCTURE.md at FTP 280 W and LTHR 168 (Z4 top 270–290 W = 96–104 %, 175–182 bpm = 104–108 %).
 */
export const ZONE_RANGES = {
  Z1: { power: [45, 55], hr: [60, 72] },
  Z2: { power: [56, 75], hr: [73, 91] },
  Z2top: { power: [70, 75], hr: [86, 91] },
  Z3: { power: [76, 90], hr: [91, 100] },
  Z4: { power: [91, 105], hr: [100, 108] },
  Z4top: { power: [96, 104], hr: [104, 108] },
  Z5: { power: [107, 120], hr: [106, 112] },
};

/**
 * @typedef {{ type: 'time', s: number } | { type: 'distance', m: number } | { type: 'lap' }} Duration
 * @typedef {{ type: 'open' }
 *   | { type: 'power', unit: 'pct_ftp', low: number, high: number }
 *   | { type: 'hr', unit: 'pct_lthr', low: number, high: number }
 *   | { type: 'pace', low: number, high: number }} Target  pace: seconds per km, low = fast
 * @typedef {{ kind: 'warmup' | 'work' | 'recovery' | 'rest' | 'cooldown', duration: Duration, target: Target,
 *   ramp?: boolean, cadence?: [number, number], pace?: [number, number], notes?: string }} Step
 * @typedef {{ kind: 'repeat', count: number, steps: (Step | Repeat)[], notes?: string }} Repeat
 * @typedef {{ version: 1, sport: 'ride' | 'run', name: string, bank?: string, level?: number, notes?: string,
 *   steps: (Step | Repeat)[] }} Workout
 */

const KINDS = new Set(['warmup', 'work', 'recovery', 'rest', 'cooldown']);

/** A zone as a target for the sport: power for rides, heart rate for runs. */
export function zoneTarget(zone, sport) {
  const z = ZONE_RANGES[zone];
  if (!z) throw new Error(`unknown zone ${zone}`);
  return sport === 'ride'
    ? { type: 'power', unit: 'pct_ftp', low: z.power[0], high: z.power[1] }
    : { type: 'hr', unit: 'pct_lthr', low: z.hr[0], high: z.hr[1] };
}

/** Problems with a workout, as text; empty when it is valid. */
export function validate(w) {
  const errors = [];
  if (!w || w.version !== 1) errors.push('version must be 1');
  if (w?.sport !== 'ride' && w?.sport !== 'run') errors.push('sport must be ride or run');
  if (!Array.isArray(w?.steps) || w.steps.length === 0) errors.push('no steps');
  const walk = (steps, path, depth) => {
    steps.forEach((s, i) => {
      const at = `${path}[${i}]`;
      if (s.kind === 'repeat') {
        if (!Number.isInteger(s.count) || s.count < 1 || s.count > 50) errors.push(`${at}: count must be 1–50`);
        if (depth > 1) errors.push(`${at}: repeats nest at most 2 deep`);
        if (!Array.isArray(s.steps) || s.steps.length === 0) errors.push(`${at}: empty repeat`);
        else walk(s.steps, `${at}.steps`, depth + 1);
        return;
      }
      if (!KINDS.has(s.kind)) errors.push(`${at}: unknown kind ${s.kind}`);
      const d = s.duration;
      if (!d || !((d.type === 'time' && d.s > 0) || (d.type === 'distance' && d.m > 0) || d.type === 'lap')) errors.push(`${at}: bad duration`);
      const t = s.target;
      if (!t || !['open', 'power', 'hr', 'pace'].includes(t.type)) errors.push(`${at}: bad target`);
      else if (t.type !== 'open' && !(t.low > 0 && t.high >= t.low)) errors.push(`${at}: target low/high`);
    });
  };
  if (Array.isArray(w?.steps)) walk(w.steps, 'steps', 0);
  return errors;
}

/** The steps in order with repeats expanded, each with the labels of the repeats around it. */
export function flatten(steps) {
  /** @type {(Step & { rep?: string })[]} */
  const out = [];
  const walk = (list, label) => {
    for (const s of list) {
      if (s.kind === 'repeat') {
        for (let i = 1; i <= s.count; i++) walk(s.steps, label ? `${label}.${i}` : `${i}/${s.count}`);
      } else out.push(label ? { ...s, rep: label } : s);
    }
  };
  walk(steps, '');
  return out;
}

/** Seconds of a step: its time, or its distance at `paceSPerKm` (default 5:30/km), or 0 for a lap step. */
export function stepSeconds(s, paceSPerKm = 330) {
  if (s.duration.type === 'time') return s.duration.s;
  if (s.duration.type === 'distance') return Math.round((s.duration.m / 1000) * paceSPerKm);
  return 0;
}

/** The middle of a target as a fraction of the anchor (1 = FTP or LTHR); null for an open or pace target. */
export function intensity(t) {
  if (t.type === 'power' || t.type === 'hr') return (t.low + t.high) / 200;
  return null;
}

/**
 * Planned time, TSS and IF from the steps. TSS = hours × IF² × 100, with IF from % FTP for rides and from % LTHR
 * for runs (an hrTSS estimate). An open step counts as Z1.
 */
export function totals(w) {
  const flat = flatten(w.steps);
  let seconds = 0;
  let load = 0;
  for (const s of flat) {
    const sec = stepSeconds(s);
    const f = intensity(s.target) ?? (w.sport === 'ride' ? 0.5 : 0.66);
    seconds += sec;
    load += sec * f * f;
  }
  const ifactor = seconds ? Math.sqrt(load / seconds) : 0;
  return {
    seconds,
    minutes: Math.round(seconds / 60),
    tss: Math.round((load / 3600) * 100),
    if: Math.round(ifactor * 100) / 100,
  };
}

/** A target in watts or beats with the anchors: "270–290 W", "175–182 bpm", "4:50–5:10/km", or "Open". */
export function targetText(t, anchors = ANCHORS) {
  if (t.type === 'power') return `${Math.round((t.low * anchors.ftp) / 100)}–${Math.round((t.high * anchors.ftp) / 100)} W`;
  if (t.type === 'hr') return `${Math.round((t.low * anchors.lthr) / 100)}–${Math.round((t.high * anchors.lthr) / 100)} bpm`;
  if (t.type === 'pace') return `${pace(t.low)}–${pace(t.high)}/km`;
  return 'Open';
}

/** The Coach zone a target sits in (by its middle), for colors; 'Z1' for open. */
export function zoneOf(t, sport) {
  const mid = intensity(t);
  if (mid == null) return 'Z1';
  const pct = mid * 100;
  const key = sport === 'ride' ? 'power' : 'hr';
  for (const z of ['Z5', 'Z4', 'Z3', 'Z2', 'Z1']) if (pct >= ZONE_RANGES[z][key][0]) return z;
  return 'Z1';
}

export function pace(sPerKm) {
  const s = Math.round(sPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1:30:00", "45:00", "30 s". */
export function clock(seconds) {
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
