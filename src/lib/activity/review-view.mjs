// The workout review as the pages show it (the web activity page and GET /api/app/activities/:id): the score, the
// step table, the set summaries and Claude's sections, as display text. Pure and client-safe (no Node imports).

import { clockText, paceText, RATING_LABEL, VERDICT_LABEL } from './adherence.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** The score's word. */
export function scoreWord(level) {
  return level === 'good' ? 'On plan' : level === 'partial' ? 'Partly on plan' : level === 'off' ? 'Off plan' : '';
}

function effortText(a, sport) {
  if (!a?.seconds) return '–';
  if (sport === 'ride') return isNum(a.watts) ? `${a.watts} W` : '–';
  return isNum(a.paceS) ? `${paceText(a.paceS)}/km` : '–';
}

/**
 * @param {any} analysis  analyzeAdherence(...)
 * @param {{ review: any | null, status: 'ready' | 'pending' | 'failed' | 'off', note?: string | null, model?: string | null, createdAt?: string | null } | null} ai
 */
export function reviewView(analysis, ai) {
  if (!analysis) return null;
  const sport = analysis.sport;
  const steps = analysis.steps.map((s) => ({
    index: s.index,
    label: s.label,
    kind: s.kind,
    zone: s.zone,
    inRepeat: s.block != null,
    // A recovery inside a repeat is judged by being easy, not by its zone: say so.
    plannedText: `${s.planned.lengthText} · ${s.block != null && s.kind !== 'work' ? 'Easy' : s.planned.targetText}`,
    doneText: s.actual?.seconds ? `${clockText(s.actual.seconds)} · ${effortText(s.actual, sport)}` : 'Not done',
    hrText: isNum(s.actual?.hr) ? `${s.actual.hr}${isNum(s.actual.maxHr) ? ` · max ${s.actual.maxHr}` : ''}` : '–',
    inTargetText: isNum(s.inTargetPct) && s.kind === 'work' ? `${s.inTargetPct} % in target` : null,
    verdict: s.verdict,
    verdictLabel: VERDICT_LABEL[s.verdict],
    plannedSeconds: s.planned.seconds ?? null,
    doneSeconds: s.actual?.seconds ?? 0,
    fromBucket: s.fromBucket,
    toBucket: s.toBucket,
  }));
  const sets = analysis.sets.map((set) => ({
    title: set.label,
    summary: `${set.hit} of ${set.total} reps on target`,
    reps: set.reps.map((r) => ({
      label: r.label,
      verdict: r.verdict,
      text: sport === 'ride' ? (isNum(r.watts) ? `${r.watts} W` : '–') : isNum(r.paceS) ? paceText(r.paceS) : '–',
      hrText: isNum(r.maxHr) ? `max ${r.maxHr}` : null,
    })),
    stats: [
      set.avgPaceS ? { label: 'Hard reps', value: `${paceText(set.avgPaceS)}/km` } : set.avgWatts ? { label: 'Hard reps', value: `${set.avgWatts} W` } : null,
      isNum(set.fadePct) ? { label: 'First → last', value: Math.abs(set.fadePct) < 1 ? 'even' : set.fadePct > 0 ? `${set.fadePct} % slower` : `${Math.abs(set.fadePct)} % faster` } : null,
      isNum(set.cvPct) ? { label: 'Spread', value: `${set.cvPct} %` } : null,
      isNum(set.hrRecoveryBpm) ? { label: 'HR drop per recovery', value: `${set.hrRecoveryBpm} bpm` } : null,
      isNum(set.peakHr) ? { label: 'Peak HR', value: `${set.peakHr} bpm` } : null,
    ].filter(Boolean),
  }));
  const r = ai?.review ?? null;
  return {
    score: analysis.score,
    level: analysis.level,
    scoreWord: scoreWord(analysis.level),
    workoutName: analysis.workout?.name ?? null,
    alignedText: analysis.alignment === 'laps' ? "Steps from your watch's laps" : analysis.alignment === 'pattern' ? 'Steps found in your pace' : 'Steps by the clock',
    extraText: analysis.totals?.extraS >= 60 ? `${clockText(analysis.totals.extraS)} after the plan` : null,
    steps,
    sets,
    flags: analysis.flags ?? [],
    ai: {
      status: ai?.status ?? 'off',
      note: ai?.note ?? null,
      headline: r?.headline ?? null,
      rating: r?.rating ?? null,
      ratingLabel: r?.rating ? RATING_LABEL[r.rating] : null,
      sections: r
        ? [
            { key: 'effect', title: 'What it did for you', items: r.trainingEffect ? [r.trainingEffect] : [] },
            { key: 'well', title: 'Went well', items: r.wentWell ?? [] },
            { key: 'improve', title: 'To improve', items: r.toImprove ?? [] },
            { key: 'next', title: 'Next time', items: r.nextTime ?? [] },
          ].filter((s) => s.items.length)
        : [],
    },
  };
}
