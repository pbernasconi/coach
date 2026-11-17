// The AI review of a finished workout: what Claude is given (the plan, the step-by-step analysis from adherence.mjs,
// the context), the shape it answers in, and the check of that answer. Pure; review.ts calls Claude and stores it.
// node --test runs review.test.mjs.

import { createHash } from 'node:crypto';
import { stepLines } from '../workouts/steps.mjs';
import { feedbackLine } from '../plan/feedback.mjs';
import { ADHERENCE_VERSION, clockText, paceText, VERDICT_LABEL } from './adherence.mjs';

/** Claude for the review: one call per workout, so the best model at medium effort. */
export const REVIEW_MODEL = 'claude-opus-5-5';
export const REVIEW_EFFORT = 'medium';
/** Reviews stop for the rest of the month at this spend (ai_usage, feature activity_review). About $0.05 each. */
export const REVIEW_MONTHLY_CAP_USD = 5;

export const RATINGS = ['nailed', 'solid', 'mixed', 'missed'];

/** The answer's JSON schema (structured outputs). */
export const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'rating', 'training_effect', 'went_well', 'to_improve', 'next_time'],
  properties: {
    headline: { type: 'string', description: 'One sentence: the verdict of the session with its key number.' },
    rating: { type: 'string', enum: RATINGS },
    training_effect: { type: 'string', description: 'Two or three sentences: what the session did for his fitness and what it cost.' },
    went_well: { type: 'array', items: { type: 'string' }, description: '1 to 4 short points with numbers.' },
    to_improve: { type: 'array', items: { type: 'string' }, description: '0 to 3 short points: what was off and why it matters.' },
    next_time: { type: 'array', items: { type: 'string' }, description: '1 to 3 concrete tips for the next session of this workout, with numbers.' },
  },
};

const clean = (s, max = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (a, n) => (Array.isArray(a) ? a.map((x) => clean(x, 300)).filter(Boolean).slice(0, n) : []);

/**
 * Claude's answer as a review, or an error. Trims and caps the lists so a long answer cannot break a page.
 * @returns {{ review: { headline: string, rating: string, trainingEffect: string, wentWell: string[], toImprove: string[], nextTime: string[] } } | { error: string }}
 */
export function parseReview(text) {
  let j;
  try {
    j = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    return { error: 'the answer is not JSON' };
  }
  if (!j || typeof j !== 'object') return { error: 'the answer is not an object' };
  const headline = clean(j.headline, 300);
  if (!headline) return { error: 'no headline' };
  const rating = RATINGS.includes(j.rating) ? j.rating : 'mixed';
  const review = {
    headline,
    rating,
    trainingEffect: clean(j.training_effect, 700),
    wentWell: list(j.went_well, 4),
    toImprove: list(j.to_improve, 3),
    nextTime: list(j.next_time, 3),
  };
  if (!review.nextTime.length && !review.wentWell.length) return { error: 'an empty review' };
  return { review };
}

const n = (v, unit = '', d = 0) => (typeof v === 'number' && Number.isFinite(v) ? `${d ? v.toFixed(d) : Math.round(v)}${unit}` : '–');

/** One step as a line of the table Claude reads. */
function stepRow(s, sport) {
  const a = s.actual ?? {};
  const effort = sport === 'ride'
    ? `${n(a.watts, ' W')}`
    : `${a.paceS ? `${paceText(a.paceS)}/km` : '–'}${a.gapPaceS && a.paceS && Math.abs(a.gapPaceS - a.paceS) >= 5 ? ` (GAP ${paceText(a.gapPaceS)})` : ''}`;
  const hr = a.hr ? `HR ${a.hr} avg, ${n(a.maxHr)} max, ${n(a.hrStart)}→${n(a.hrEnd)}` : 'no HR';
  const inT = s.inTargetPct != null ? ` · ${s.inTargetPct} % of it in the target` : '';
  return `- ${s.label}: planned ${s.planned.lengthText} at ${s.planned.targetText} | done ${clockText(a.seconds ?? 0)}, ${a.distance ? `${(a.distance / 1000).toFixed(2)} km, ` : ''}${effort}, ${hr}${inT} | ${VERDICT_LABEL[s.verdict]}`;
}

function setRow(set, sport) {
  const reps = set.reps
    .map((r) => (sport === 'ride' ? n(r.watts, ' W') : r.paceS ? paceText(r.paceS) : '–') + (r.maxHr ? ` (max ${r.maxHr})` : ''))
    .join(' · ');
  return [
    `- ${set.label}: ${set.hit} of ${set.total} reps on target. Reps: ${reps}${sport === 'ride' ? '' : ' /km'}.`,
    set.avgPaceS ? `  Average of the hard reps ${paceText(set.avgPaceS)}/km.` : set.avgWatts ? `  Average of the hard reps ${set.avgWatts} W.` : null,
    set.cvPct != null ? `  Spread ${set.cvPct} %, ${set.fadePct > 0 ? `faded ${set.fadePct} %` : `${Math.abs(set.fadePct ?? 0)} % faster`} first to last hard rep.` : null,
    set.hrRecoveryBpm != null ? `  Heart rate fell ${set.hrRecoveryBpm} bpm on average over a recovery. Peak ${n(set.peakHr)} bpm.` : null,
  ].filter(Boolean).join('\n');
}

/**
 * The user message: everything Claude needs about this one session, as plain text sections.
 * @param {{
 *   activity: { name: string, day: string, startLocal: string, sportType: string, place: string | null, trainer: boolean,
 *     stats: any, weather: any, watch: any, effort: any },
 *   planned: { title: string, description?: string | null, why?: string | null, workoutType?: string | null, steps: any },
 *   analysis: any,
 *   feedback?: { feel: number | null, rpe: number | null, comment: string | null } | null,
 *   anchors: { lthr: number, ftp: number, maxHr?: number | null, paceS?: number | null, restingHr?: number | null },
 *   load?: { before: { ctl: number, atl: number, tsb: number } | null, after: { ctl: number, atl: number, tsb: number } } | null,
 *   garmin?: Record<string, number> | null,
 *   history?: { day: string, title: string, score: number | null, sets: any[], nextTime: string[], headline: string | null }[],
 *   next?: { date: string, title: string, steps?: any } | null,
 * }} input
 */
export function reviewInput({ activity: v, planned, analysis: r, feedback, anchors, load, garmin, history = [], next }) {
  const sport = r.sport;
  const st = v.stats ?? {};
  const out = [];
  out.push('<planned_workout>');
  out.push(`${planned.title}${planned.steps?.bank ? ` (bank ${planned.steps.bank}, level ${planned.steps.level ?? 0})` : ''}`);
  for (const l of stepLines(planned.steps)) out.push(`- ${l.label}: ${l.detail}`);
  if (planned.steps?.notes) out.push(`Notes: ${clean(planned.steps.notes, 600)}`);
  if (planned.description) out.push(`Description: ${clean(planned.description, 800)}`);
  if (planned.why) out.push(`Why: ${clean(planned.why, 400)}`);
  out.push('</planned_workout>', '');

  out.push('<done>');
  out.push(`${v.name} on ${v.day} at ${String(v.startLocal).slice(11, 16)}${v.place ? `, ${v.place}` : ''}${v.trainer ? ', indoors' : ''} (${v.sportType})`);
  const avgPace = st.avgSpeed > 0.3 ? `${paceText(1000 / st.avgSpeed)}/km` : null;
  const gap = st.avgGapSpeed > 0.3 ? `GAP ${paceText(1000 / st.avgGapSpeed)}/km` : null;
  out.push([
    `${(st.distance / 1000).toFixed(2)} km`, `${clockText(st.moving)} moving (${clockText(st.elapsed)} elapsed)`,
    sport === 'ride' ? (st.avgWatts ? `${Math.round(st.avgWatts)} W avg${st.np ? `, NP ${Math.round(st.np)} W` : ''}` : null) : avgPace, sport === 'ride' ? null : gap,
    st.avgHr ? `HR ${Math.round(st.avgHr)} avg, ${n(st.maxHr)} max` : null, `${Math.round(st.elevGain ?? 0)} m up`,
    v.effort?.tss ? `TSS ${Math.round(v.effort.tss)}` : null,
  ].filter(Boolean).join(', '));
  const w = v.weather;
  if (w) out.push(`Weather: ${[w.tempC != null ? `${Math.round(w.tempC)} °C` : null, w.feelsLikeC != null ? `feels ${Math.round(w.feelsLikeC)} °C` : null, w.windKmh != null ? `wind ${Math.round(w.windKmh)} km/h` : null, w.humidityPct != null ? `${Math.round(w.humidityPct)} % humidity` : null].filter(Boolean).join(', ')}`);
  const g = v.watch;
  if (g) {
    out.push(`Garmin: ${[
      g.aerobicTe != null ? `aerobic training effect ${g.aerobicTe}` : null, g.anaerobicTe != null ? `anaerobic ${g.anaerobicTe}` : null,
      g.teLabel ? `"${g.teLabel}"` : null, g.load != null ? `load ${Math.round(g.load)}` : null, g.vo2max != null ? `VO2max ${g.vo2max}` : null,
      g.performanceCondition != null ? `performance condition ${g.performanceCondition > 0 ? '+' : ''}${g.performanceCondition}` : null,
      g.staminaEnd != null ? `stamina ${g.staminaStart ?? '–'} → ${g.staminaEnd} %` : null,
    ].filter(Boolean).join(', ')}`);
  }
  const fb = feedback ? feedbackLine(feedback) : '';
  out.push(fb ? `How it felt (logged): ${fb}` : 'How it felt: not logged.');
  out.push('</done>', '');

  out.push(`<plan_vs_done score="${r.score ?? '–'}" aligned_by="${r.alignment === 'laps' ? "the watch's laps (one per step)" : r.alignment === 'pattern' ? 'the interval pattern in the pace' : 'the clock (planned times from the start)'}">`);
  for (const s of r.steps) out.push(stepRow(s, sport));
  if (r.totals?.extraS >= 60) out.push(`- After the plan: ${clockText(r.totals.extraS)} more.`);
  for (const set of r.sets ?? []) out.push(setRow(set, sport));
  out.push('</plan_vs_done>', '');

  if (r.flags?.length) out.push('<noticed>', ...r.flags.map((f) => `- ${f}`), '</noticed>', '');

  out.push('<athlete>');
  out.push([
    `LTHR ${anchors.lthr} bpm`, anchors.maxHr ? `max HR about ${anchors.maxHr}` : null, anchors.restingHr ? `resting ${anchors.restingHr}` : null,
    anchors.paceS ? `threshold pace ${paceText(anchors.paceS)}/km` : null, `FTP ${anchors.ftp} W`,
  ].filter(Boolean).join(', '));
  if (load?.before) out.push(`Before the session: fitness (CTL) ${load.before.ctl.toFixed(0)}, fatigue (ATL) ${load.before.atl.toFixed(0)}, form (TSB) ${load.before.tsb.toFixed(0)}.`);
  if (garmin) {
    const gl = [
      garmin.sleep_total_min != null ? `slept ${Math.floor(garmin.sleep_total_min / 60)} h ${Math.round(garmin.sleep_total_min % 60)} min` : null,
      garmin.sleep_score != null ? `sleep score ${garmin.sleep_score}` : null, garmin.hrv_night_avg_ms != null ? `HRV ${garmin.hrv_night_avg_ms} ms` : null,
      garmin.resting_hr_bpm != null ? `resting HR ${garmin.resting_hr_bpm}` : null, garmin.body_battery_high != null ? `body battery up to ${garmin.body_battery_high}` : null,
      garmin.training_readiness != null ? `training readiness ${garmin.training_readiness}` : null,
    ].filter(Boolean);
    if (gl.length) out.push(`That morning: ${gl.join(', ')}.`);
  }
  out.push('</athlete>', '');

  if (history.length) {
    out.push('<last_sessions_of_this_workout>');
    for (const h of history) {
      out.push(`${h.day} · ${h.title} · score ${h.score ?? '–'}${h.headline ? ` · "${clean(h.headline, 200)}"` : ''}`);
      for (const set of h.sets ?? []) out.push(setRow(set, sport));
      if (h.nextTime?.length) out.push(`  Your tips then: ${h.nextTime.map((t) => `"${clean(t, 200)}"`).join(' ')}`);
    }
    out.push('</last_sessions_of_this_workout>', '');
  } else {
    out.push('<last_sessions_of_this_workout>None reviewed yet.</last_sessions_of_this_workout>', '');
  }
  if (next) {
    out.push('<next_time_in_the_plan>');
    out.push(`${next.date}: ${next.title}`);
    if (next.steps) for (const l of stepLines(next.steps)) out.push(`- ${l.label}: ${l.detail}`);
    out.push('</next_time_in_the_plan>');
  } else {
    out.push('<next_time_in_the_plan>Not planned yet.</next_time_in_the_plan>');
  }
  return out.join('\n');
}

/**
 * The key of a review: what it was made from. A stored review whose key differs (a changed plan, a new feel logged, a
 * new analysis or prompt) is made again when the page asks.
 */
export function reviewKey({ promptVersion, plannedId, steps, analysis, feedback }) {
  const basis = JSON.stringify({
    v: ADHERENCE_VERSION, p: promptVersion, plannedId, steps,
    a: analysis ? analysis.steps.map((s) => [s.verdict, s.start, s.end]) : null,
    f: feedback ? [feedback.feel ?? null, feedback.rpe ?? null, feedback.comment ?? null] : null,
  });
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}
