// Planned-versus-completed compliance for one planned workout, as TrainingPeaks colours it. No framework or
// database imports, so node --test can run it (compliance.test.mjs).
//
// The ratio is completed / planned. Duration comes first (as TrainingPeaks), TSS when a duration is missing on
// either side.
//   good    80–120 %                 (green)
//   partial 50–80 % or 120–150 %     (yellow)
//   off     under 50 % or over 150 % (orange)
//   done    done, but nothing to compare (green, no ratio)
//   missed  a past day with no match (red)
//   skipped, rest, today, planned    (grey)

export const LEVELS = ['good', 'partial', 'off', 'done', 'missed', 'skipped', 'rest', 'today', 'planned'];

export const LEVEL_LABEL = {
  good: 'On target',
  partial: 'Partly on target',
  off: 'Far off target',
  done: 'Done',
  missed: 'Missed',
  skipped: 'Skipped',
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
 * @param {{ rest?: boolean }} [opts]  rest: the workout is a rest day
 * @returns {{ level: string, label: string, ratio: number | null, basis: 'duration' | 'tss' | null }}
 */
export function complianceOf(planned, state, actual, opts = {}) {
  const out = (level, ratio = null, basis = null) => ({ level, label: LEVEL_LABEL[level], ratio, basis });
  if (state === 'skipped') return out('skipped');
  if (opts.rest) return out('rest');
  if (state === 'missed') return out('missed');
  if (state !== 'done') return out(state === 'today' ? 'today' : 'planned');
  if (!actual) return out('done');
  if (positive(planned.duration) && positive(actual.min)) {
    const ratio = actual.min / planned.duration;
    return out(levelForRatio(ratio), ratio, 'duration');
  }
  if (positive(planned.tss) && positive(actual.tss)) {
    const ratio = actual.tss / planned.tss;
    return out(levelForRatio(ratio), ratio, 'tss');
  }
  return out('done');
}
