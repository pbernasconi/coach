// Planned-versus-completed compliance for one planned workout, as TrainingPeaks colours it. No framework or
// database imports, so node --test can run it (compliance.test.mjs).
//
// The ratio is completed / planned. Duration comes first (as TrainingPeaks), TSS when a duration is missing on
// either side.
//   good    80–120 %                 (green, "Done")
//   partial 50–80 % or 120–150 %     (yellow, "Partly done")
//   off     under 50 % or over 150 % (yellow, "Partly done": still a session done)
//   done    done, but nothing to compare (green, no ratio)
//   A strength workout with a Lift session compares working sets logged with sets planned instead: 80 % or more is
//   good; extra sets never make it partial. Under 80 % it is still good when the watch time (or TSS) is on plan:
//   sets left unticked (a swapped exercise, a set cut from the template mid-day) are not a short session.
//   Otherwise it is partial ("Partly done").
//   missed  a past day with no match (red, "Not done")
//   skipped skipped on purpose       (red, "Not done"; the reason is kept, src/lib/plan/skip.mjs)
//   rest, today, planned             (grey)

export const LEVELS = ['good', 'partial', 'off', 'done', 'missed', 'skipped', 'rest', 'today', 'planned'];

export const LEVEL_LABEL = {
  good: 'Done',
  partial: 'Partly done',
  off: 'Partly done',
  done: 'Done',
  missed: 'Not done',
  skipped: 'Not done',
  rest: 'Rest',
  today: 'Today',
  planned: 'Planned',
};

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** The level for a completed / planned ratio. */
export function levelForRatio(ratio) {
  if (ratio >= 0.8 && ratio <= 1.2) return 'good';
  if (ratio >= 0.5 && ratio <= 1.5) return 'partial';
  return 'off';
}

/**
 * @param {{ duration?: number | null, tss?: number | null }} planned  minutes and TSS of the planned workout
 * @param {'done' | 'skipped' | 'missed' | 'today' | 'planned'} state  from matchWeek
 * @param {{ min?: number | null, tss?: number | null } | null} actual  the matched activity, when there is one
 * @param {{ rest?: boolean, sets?: { done: number, planned: number } | null }} [opts]  rest: the workout is a rest day;
 *   sets: the working sets of its Lift session, logged and planned
 * @returns {{ level: string, label: string, ratio: number | null, basis: 'duration' | 'tss' | 'sets' | null }}
 */
export function complianceOf(planned, state, actual, opts = {}) {
  const out = (level, ratio = null, basis = null) => ({ level, label: LEVEL_LABEL[level], ratio, basis });
  if (state === 'skipped') return out('skipped');
  if (opts.rest) return out('rest');
  if (state === 'missed') return out('missed');
  if (state !== 'done') return out(state === 'today' ? 'today' : 'planned');
  const timed = byTime(planned, actual);
  const sets = opts.sets;
  if (sets && positive(sets.planned) && positive(sets.done)) {
    const ratio = sets.done / sets.planned;
    if (ratio >= 0.8) return out('good', ratio, 'sets');
    return timed?.level === 'good' ? out('good', timed.ratio, timed.basis) : out('partial', ratio, 'sets');
  }
  return timed ? out(timed.level, timed.ratio, timed.basis) : out('done');
}

/** Duration first, TSS when a duration is missing on either side; null when there is nothing to compare. */
function byTime(planned, actual) {
  if (!actual) return null;
  if (positive(planned.duration) && positive(actual.min)) {
    const ratio = actual.min / planned.duration;
    return { level: levelForRatio(ratio), ratio, basis: 'duration' };
  }
  if (positive(planned.tss) && positive(actual.tss)) {
    const ratio = actual.tss / planned.tss;
    return { level: levelForRatio(ratio), ratio, basis: 'tss' };
  }
  return null;
}
