// The coach's workout bank (plans/PLAN-STRUCTURE.md) as structured workouts, each with its own progression.
// `level` 0 is the first step of a progression; /plan raises it by 1 when the last one was done, and repeats or
// lowers it when it was not. Pure; node --test.

import { zoneTarget } from './steps.mjs';

const min = (m) => ({ type: 'time', s: Math.round(m * 60) });
const sec = (s) => ({ type: 'time', s });
const open = { type: 'open' };
const step = (kind, duration, target, extra = {}) => ({ kind, duration, target, ...extra });
// Z5 by power on the bike; on foot by effort only (PLAN-STRUCTURE: heart rate for all but Z5, it lags).
const hard = (sport) => (sport === 'ride' ? zoneTarget('Z5', 'ride') : open);

/** The finish every workout of the bank shares: 10–20 min at the top of Z2 (lactate clearance), here 15. */
const clearance = (sport) => step('work', min(15), zoneTarget('Z2top', sport), { notes: 'Lactate clearance at the top of zone two. Do not drop it.' });

/** Easy to the planned total time (bike: 1–2.5 h for a workout; run: the cap). Nothing when already there. */
function easyTo(steps, sport, totalMin) {
  const used = steps.reduce(function count(n, s) {
    return s.kind === 'repeat' ? n + s.count * s.steps.reduce(count, 0) : n + (s.duration.type === 'time' ? s.duration.s : 0);
  }, 0);
  const left = Math.round(totalMin * 60 - used);
  return left >= 120 ? [...steps, step('cooldown', sec(left), zoneTarget(sport === 'ride' ? 'Z2' : 'Z1', sport), { notes: 'Easy to the end.' })] : steps;
}

export const BANK = {
  /** 6 × 5 min at the top of Z4, 2 min easy; +1 set per level up to 10 × 5. Run: 10 min warm-up, 90 min cap. */
  'threshold-a': {
    name: 'Threshold A',
    levels: 5,
    describe: (l) => `${6 + l}×5 min top of Z4`,
    build(sport, level, totalMin) {
      const sets = Math.min(10, 6 + level);
      const steps = [
        step('warmup', min(sport === 'ride' ? 30 : 10), zoneTarget(sport === 'ride' ? 'Z2' : 'Z1', sport), { notes: 'Easy, building to zone two.' }),
        { kind: 'repeat', count: sets, steps: [
          step('work', min(5), zoneTarget('Z4top', sport), { notes: 'Top of zone four. Start reasonable, end with a little left.' }),
          step('recovery', min(2), zoneTarget('Z1', sport)),
        ] },
        clearance(sport),
      ];
      return easyTo(steps, sport, sport === 'run' ? Math.min(totalMin, 90) : totalMin);
    },
  },

  /** 5 × [1' Z4, 1' Z5, 1' Z4, 1' Z5, 1' Z4, 3' easy]; each level adds 1 min to a Z4 part until the set is 8 min. */
  'threshold-b': {
    name: 'Threshold B',
    levels: 4,
    describe: (l) => `5×[${5 + l} min Z4/Z5]`,
    build(sport, level, totalMin) {
      if (sport === 'run') {
        const steps = [
          step('warmup', min(10), zoneTarget('Z1', 'run')),
          { kind: 'repeat', count: 5, steps: [
            step('work', min(1), hard('run'), { notes: 'Hard.' }),
            step('work', min(2), zoneTarget('Z4', 'run')),
            step('recovery', min(3), zoneTarget('Z1', 'run')),
          ] },
          clearance('run'),
        ];
        return easyTo(steps, 'run', Math.min(totalMin, 60));
      }
      const extra = [0, 0, 0];
      for (let i = 0; i < Math.min(level, 3); i++) extra[i % 3] += 1;
      const z4 = (i) => step('work', min(1 + extra[i]), zoneTarget('Z4', 'ride'));
      const z5 = step('work', min(1), { type: 'power', unit: 'pct_ftp', low: 105, high: 112 }, { notes: 'A little above the minute before.' });
      const steps = [
        step('warmup', min(20), zoneTarget('Z2', 'ride')),
        { kind: 'repeat', count: 5, steps: [z4(0), z5, z4(1), z5, z4(2), step('recovery', min(3), zoneTarget('Z1', 'ride'))] },
        clearance('ride'),
      ];
      return easyTo(steps, 'ride', totalMin);
    },
  },

  /** 4 × 3 min hard, 3 min easy; then 5 sets; then +30 s on work and rest per level up to 5 × 5. */
  'vo2-a': {
    name: 'VO2 A',
    levels: 6,
    describe: (l) => { const { sets, m } = vo2a(l); return `${sets}×${m} min hard`; },
    build(sport, level, totalMin) {
      const { sets, m } = vo2a(level);
      const steps = [
        step('warmup', min(15), zoneTarget('Z1', sport), { notes: 'Easy.' }),
        { kind: 'repeat', count: sets, steps: [
          step('work', min(m), hard(sport), { notes: 'Best sustainable: the highest you can hold for every set.' }),
          step('recovery', min(m), zoneTarget('Z1', sport)),
        ] },
        clearance(sport),
      ];
      return easyTo(steps, sport, sport === 'run' ? Math.min(totalMin, 60) : totalMin);
    },
  },

  /** Bike: 3 × [6 × 30 s hard / 30 s easy], 5 min between sets; +1 rep per set per level up to 10. Run: 12 × 1/1 → 15 × 1/1, then less rest. */
  'vo2-b': {
    name: 'VO2 B',
    levels: 6,
    describe: (l) => `3×[${Math.min(10, 6 + l)}×30/30]`,
    build(sport, level, totalMin) {
      if (sport === 'run') {
        const reps = Math.min(15, 12 + level);
        const rest = level <= 3 ? 60 : level === 4 ? 45 : 30;
        const steps = [
          step('warmup', min(15), zoneTarget('Z1', 'run')),
          { kind: 'repeat', count: reps, steps: [step('work', min(1), hard('run'), { notes: 'Hard.' }), step('recovery', sec(rest), zoneTarget('Z1', 'run'))] },
          clearance('run'),
        ];
        return easyTo(steps, 'run', Math.min(totalMin, 60));
      }
      const reps = Math.min(10, 6 + level);
      const set = { kind: 'repeat', count: reps, steps: [step('work', sec(30), hard('ride'), { notes: 'Hard: best sustainable.' }), step('recovery', sec(30), zoneTarget('Z1', 'ride'))] };
      const steps = [
        step('warmup', min(15), zoneTarget('Z1', 'ride'), { notes: 'Easy.' }),
        { kind: 'repeat', count: 3, steps: [set, step('recovery', min(5), zoneTarget('Z1', 'ride'), { notes: 'Easy between sets.' })] },
        clearance('ride'),
      ];
      return easyTo(steps, 'ride', totalMin);
    },
  },

  /** 3 × 20 min Z3 at 60–70 rpm, 5 min easy; +5 min per interval per level. */
  tempo: {
    name: 'Tempo',
    levels: 4,
    describe: (l) => `3×${20 + 5 * l} min Z3`,
    build(sport, level, totalMin) {
      const m = 20 + 5 * level;
      const steps = [
        step('warmup', min(15), zoneTarget('Z2', sport)),
        { kind: 'repeat', count: 3, steps: [
          step('work', min(m), zoneTarget('Z3', sport), sport === 'ride' ? { cadence: [60, 70], notes: 'Low cadence.' } : {}),
          step('recovery', min(5), zoneTarget('Z1', sport)),
        ] },
        step('cooldown', min(15), zoneTarget('Z1', sport)),
      ];
      return easyTo(steps, sport, totalMin);
    },
  },

  /** An aerobic day: Z2 on the bike (Z1/low Z2 on foot), with 6 sprints or 6 strides; ≥3 min full rest between. */
  easy: {
    name: 'Aerobic',
    levels: 1,
    title: (sport, opts = {}) => {
      const reps = opts.reps ?? 6;
      const base = opts.zone === 'Z1' ? 'Recovery' : sport === 'ride' ? 'Endurance ride' : 'Easy run';
      return reps ? `${base} + ${reps} ${sport === 'ride' ? 'sprints' : 'strides'}` : base;
    },
    build(sport, _level, totalMin, opts = {}) {
      const reps = opts.reps ?? 6;
      const sprintMin = reps ? reps * (3 + (sport === 'ride' ? 8 : 20) / 60) : 0;
      const main = Math.max(5, Math.round(totalMin - 10 - sprintMin));
      const steps = [
        step('warmup', min(10), zoneTarget('Z1', sport)),
        step('work', min(main), zoneTarget(opts.zone ?? (sport === 'ride' ? 'Z2' : 'Z1'), sport), { notes: opts.zone === 'Z1' ? 'Easy.' : sport === 'ride' ? 'Steady zone two.' : 'Easy, up to low zone two.' }),
      ];
      if (!reps) return steps;
      return [
        ...steps,
        { kind: 'repeat', count: reps, steps: [
          step('work', sec(sport === 'ride' ? 8 : 20), open, { notes: sport === 'ride' ? 'Sprint: all out.' : 'Stride: fast and relaxed.' }),
          step('recovery', min(3), zoneTarget('Z1', sport), { notes: 'Full rest.' }),
        ] },
      ];
    },
  },

  /** A long day: mostly Z1/Z2 (bike Z2, run Z1 with a solid Z2 part). */
  long: {
    name: 'Long',
    levels: 1,
    title: (sport, opts = {}) => `Long ${sport}${opts.topMin ? `, ${opts.topMin} min top of Z2` : ''}`,
    build(sport, _level, totalMin, opts = {}) {
      if (sport === 'ride') {
        const top = opts.topMin ?? 0;
        return [
          step('warmup', min(15), zoneTarget('Z1', 'ride')),
          step('work', min(totalMin - 25 - top), zoneTarget('Z2', 'ride')),
          ...(top ? [step('work', min(top), zoneTarget('Z2top', 'ride'), { notes: 'Top of zone two.' })] : []),
          step('cooldown', min(10), zoneTarget('Z1', 'ride')),
        ];
      }
      const z2 = opts.topMin ?? Math.round((totalMin - 20) / 3);
      return [
        step('warmup', min(10), zoneTarget('Z1', 'run')),
        step('work', min(totalMin - 20 - z2), zoneTarget('Z1', 'run')),
        step('work', min(z2), zoneTarget('Z2top', 'run'), { notes: 'Solid zone two part.' }),
        step('cooldown', min(10), zoneTarget('Z1', 'run')),
      ];
    },
  },

  /** The 10k test: warm-up with strides, 10 km all out (goal 4:00/km), cool-down. */
  'test-10k': {
    name: '10k test',
    levels: 1,
    title: () => '10k test',
    build() {
      return [
        step('warmup', min(15), zoneTarget('Z1', 'run')),
        { kind: 'repeat', count: 4, steps: [step('work', sec(20), open, { notes: 'Stride.' }), step('recovery', sec(60), zoneTarget('Z1', 'run'))] },
        step('work', { type: 'distance', m: 10000 }, open, { notes: 'Your best even pace. Goal is four minutes per km.' }),
        step('cooldown', min(10), zoneTarget('Z1', 'run')),
      ];
    },
  },
};

function vo2a(level) {
  if (level <= 0) return { sets: 4, m: 3 };
  return { sets: 5, m: Math.min(5, 3 + 0.5 * (level - 1)) };
}

/**
 * A bank workout as a structured workout.
 * @param {string} bank 'threshold-a' | 'threshold-b' | 'vo2-a' | 'vo2-b' | 'tempo' | 'easy' | 'long' | 'test-10k'
 * @param {'ride' | 'run'} sport
 * @param {number} level the step of its progression, 0 first (clamped to the bank's levels)
 * @param {number} totalMin the planned time; easy riding fills a workout to it
 * @param {{ reps?: number, topMin?: number, zone?: string }} [opts] easy: sprints or strides (0 for none) and its zone
 *   (Z1 for a recovery spin); long: minutes at the top of Z2
 * @returns {import('./steps.mjs').Workout}
 */
export function bankWorkout(bank, sport, level = 0, totalMin = 60, opts = {}) {
  const b = BANK[bank];
  if (!b) throw new Error(`unknown bank workout ${bank}`);
  const l = Math.max(0, Math.min(b.levels - 1, Math.round(level)));
  const name = b.title ? b.title(sport, opts) : `${b.name}: ${b.describe(l)}`;
  return { version: 1, sport, name, bank, level: l, steps: b.build(sport, l, totalMin, opts) };
}
