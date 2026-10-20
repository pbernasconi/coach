// A structured workout as a Garmin Connect workout (the `workout-service` JSON that scripts/garmin uploads with
// garminconnect's upload_workout / update_workout). Ids from garminconnect 0.3.19 workout.py
// (docs/research/structured-workouts.md §2): sport running 1 / cycling 2; step warmup 1, cooldown 2, interval 3,
// recovery 4, rest 5, repeat 6; end lap.button 1, time 2, distance 3, iterations 7; target no.target 1,
// power.zone 2, cadence 3, heart.rate.zone 4, pace.zone 6. A custom range is targetValueOne/Two: bpm, watts, or
// m/s (the slower pace is the lower value). Garmin has no ramps: a ramp becomes its range. Pure; node --test.

import { ANCHORS, totals } from './steps.mjs';

const SPORT = { run: { sportTypeId: 1, sportTypeKey: 'running' }, ride: { sportTypeId: 2, sportTypeKey: 'cycling' } };
const STEP = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  work: { stepTypeId: 3, stepTypeKey: 'interval' },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery' },
  rest: { stepTypeId: 5, stepTypeKey: 'rest' },
  repeat: { stepTypeId: 6, stepTypeKey: 'repeat' },
};
const END = {
  lap: { conditionTypeId: 1, conditionTypeKey: 'lap.button' },
  time: { conditionTypeId: 2, conditionTypeKey: 'time' },
  distance: { conditionTypeId: 3, conditionTypeKey: 'distance' },
  iterations: { conditionTypeId: 7, conditionTypeKey: 'iterations' },
};
const TARGET = {
  open: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  power: { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power.zone' },
  cadence: { workoutTargetTypeId: 3, workoutTargetTypeKey: 'cadence' },
  hr: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' },
  pace: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' },
};

const round1 = (n) => Math.round(n * 1000) / 1000;

/** The target fields of a step, in Garmin units, from the anchors. */
export function garminTarget(t, anchors = ANCHORS) {
  if (t.type === 'hr') {
    return { targetType: TARGET.hr, targetValueOne: Math.round((t.low * anchors.lthr) / 100), targetValueTwo: Math.round((t.high * anchors.lthr) / 100) };
  }
  if (t.type === 'power') {
    return { targetType: TARGET.power, targetValueOne: Math.round((t.low * anchors.ftp) / 100), targetValueTwo: Math.round((t.high * anchors.ftp) / 100) };
  }
  if (t.type === 'pace') {
    // low = the fast pace (fewer s/km). In m/s the slower pace is the lower value.
    return { targetType: TARGET.pace, targetValueOne: round1(1000 / t.high), targetValueTwo: round1(1000 / t.low) };
  }
  return { targetType: TARGET.open };
}

function end(d) {
  if (d.type === 'time') return { endCondition: END.time, endConditionValue: d.s };
  if (d.type === 'distance') return { endCondition: END.distance, endConditionValue: d.m };
  return { endCondition: END.lap };
}

/**
 * @param {import('./steps.mjs').Workout} w
 * @param {{ name: string, description?: string }} meta the name shown on the watch, and the description
 * @param {{ ftp: number, lthr: number }} [anchors]
 */
export function toGarmin(w, meta, anchors = ANCHORS) {
  let order = 0;
  const build = (list, depth) =>
    list.flatMap((s) => {
      if (s.kind === 'repeat') {
        // The watch's support for a repeat inside a repeat is unconfirmed: write the outer one out.
        if (depth > 0 || s.steps.some((x) => x.kind === 'repeat')) {
          return Array.from({ length: s.count }, () => build(s.steps, depth)).flat();
        }
        const stepOrder = ++order;
        return [{
          type: 'RepeatGroupDTO',
          stepOrder,
          stepType: STEP.repeat,
          numberOfIterations: s.count,
          endCondition: END.iterations,
          endConditionValue: s.count,
          smartRepeat: false,
          skipLastRestStep: false,
          workoutSteps: build(s.steps, depth + 1),
        }];
      }
      const step = {
        type: 'ExecutableStepDTO',
        stepOrder: ++order,
        stepType: STEP[s.kind] ?? STEP.work,
        ...end(s.duration),
        ...garminTarget(s.target, anchors),
      };
      if (s.notes) step.description = String(s.notes).slice(0, 200);
      if (s.cadence) Object.assign(step, { secondaryTargetType: TARGET.cadence, secondaryTargetValueOne: s.cadence[0], secondaryTargetValueTwo: s.cadence[1] });
      return [step];
    });
  const steps = build(w.steps, 0);
  return {
    workoutName: meta.name.slice(0, 80),
    description: (meta.description ?? '').slice(0, 500),
    sportType: SPORT[w.sport],
    estimatedDurationInSecs: totals(w).seconds,
    workoutSegments: [{ segmentOrder: 1, sportType: SPORT[w.sport], workoutSteps: steps }],
  };
}

/** Executable steps in a Garmin workout, repeats expanded: to compare with what Garmin stored. */
export function garminStepCount(steps) {
  return (steps ?? []).reduce(
    (n, s) => n + (s.type === 'RepeatGroupDTO' ? (s.numberOfIterations ?? 1) * garminStepCount(s.workoutSteps) : 1),
    0
  );
}
