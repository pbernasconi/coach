// Plan versus done, step by step: a structured workout (src/lib/workouts/steps.mjs) laid over the activity that
// completed it. Each planned step gets its stretch of the activity (from the watch's laps when the watch ran the
// workout, else by finding the interval pattern in the pace or power, else by the clock), what was done in it (time,
// pace, heart rate, power), and a verdict against its target. Repeats get a set summary (rep by rep, consistency, fade,
// heart-rate recovery), and the whole a score. The AI review (review.mjs) reads this; the pages show it.
// No framework or database imports, so node --test can run it (adherence.test.mjs).

import { ANCHORS, STEP_KIND, stepLength, stepZone, targetText } from '../workouts/steps.mjs';
import { bucketOf } from './ranges.mjs';

/** Version of the analysis shape: a stored review of an older shape is made again. */
export const ADHERENCE_VERSION = 1;

/** What a verdict is worth in the score. */
const VALUE = { hit: 1, close: 0.75, easy: 0.4, hard: 0.5, short: 0.5, missed: 0 };

/** How a verdict reads. */
export const VERDICT_LABEL = {
  hit: 'On target',
  close: 'Close',
  easy: 'Too easy',
  hard: 'Too hard',
  short: 'Cut short',
  missed: 'Not done',
};

/** How the AI review's rating reads (review.mjs). */
export const RATING_LABEL = { nailed: 'Nailed it', solid: 'Solid', mixed: 'Mixed', missed: 'Missed the point' };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (v, d = 0) => (isNum(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/** "4:49" for seconds per km. */
export function paceText(sPerKm) {
  if (!isNum(sPerKm) || sPerKm <= 0) return '–';
  const s = Math.round(sPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "3:00", "1:05:00" for seconds. */
export function clockText(seconds) {
  if (!isNum(seconds)) return '–';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// ----- The plan as a list of steps -----

/**
 * The steps in order with repeats expanded and labelled: "Warm-up", "Rep 2/5", "Easy 2/5", "Set 1/3 · rep 4/6".
 * `block` is the index of the top-level repeat a step belongs to (null outside one).
 * @param {import('../workouts/steps.mjs').Workout} w
 */
export function plannedSteps(w) {
  /** @type {{ step: any, label: string, block: number | null, rep: number | null, reps: number | null }[]} */
  const out = [];
  (w.steps ?? []).forEach((s, top) => {
    if (s.kind !== 'repeat') {
      out.push({ step: s, label: topLabel(s, w.sport), block: null, rep: null, reps: null });
      return;
    }
    const nested = (s.steps ?? []).some((x) => x.kind === 'repeat');
    const works = (s.steps ?? []).filter((x) => x.kind === 'work').length;
    for (let r = 1; r <= s.count; r++) {
      let k = 0;
      for (const inner of s.steps ?? []) {
        if (inner.kind === 'repeat') {
          for (let i = 1; i <= inner.count; i++) {
            for (const x of inner.steps ?? []) {
              if (x.kind === 'repeat') continue; // repeats nest at most 2 deep
              const what = x.kind === 'work' ? 'rep' : 'easy';
              out.push({ step: x, label: `Set ${r}/${s.count} · ${what} ${i}/${inner.count}`, block: top, rep: r, reps: s.count });
            }
          }
          continue;
        }
        if (inner.kind === 'work') k++;
        const base = inner.kind === 'work' ? `Rep ${r}/${s.count}` : nested ? `Easy after set ${r}` : `Easy ${r}/${s.count}`;
        const label = inner.kind === 'work' && works > 1 ? `${base} · ${k}` : base;
        out.push({ step: inner, label, block: top, rep: r, reps: s.count });
      }
    }
  });
  return out;
}

function topLabel(s, sport) {
  if (s.kind !== 'work') return STEP_KIND[s.kind] ?? s.kind;
  if (/lactate clearance/i.test(s.notes ?? '')) return 'Lactate clearance';
  if (!s.target || s.target.type === 'open') return s.duration?.type === 'distance' ? `${stepLength(s)} effort` : 'Hard';
  return `Main · ${stepZone(s, sport).replace('top', ' top')}`;
}

/** Planned seconds of a step; distance at `paceS`, a lap step 0 (unknown). */
function plannedSeconds(s, paceS) {
  const d = s.duration ?? {};
  if (d.type === 'time') return d.s;
  if (d.type === 'distance') return Math.round((d.m / 1000) * paceS);
  return 0;
}

// ----- The activity as time series -----

/**
 * The activity's streams as one shape: `t` elapsed seconds per point; `d` meters; `v` speed (m/s); `gap`
 * grade-adjusted speed; `hr`; `w` watts. From the page's Series (queries.ts), which is the stream cut into buckets.
 */
function trackOf(series) {
  if (!series?.t?.length) return null;
  return { t: series.t, d: series.d ?? null, v: series.speed ?? null, gap: series.gap ?? null, hr: series.hr ?? null, w: series.watts ?? null, bucketStart: series.bucketStart ?? null };
}

/** The elapsed second of a full-resolution stream index, from the bucket starts. */
function timeOfIndex(track, index) {
  if (!track.bucketStart?.length) return null;
  const b = bucketOf(index, track.bucketStart);
  if (b < 0) return null;
  const s0 = track.bucketStart[b];
  const s1 = track.bucketStart[b + 1];
  const t0 = track.t[b];
  const t1 = track.t[b + 1];
  if (s1 == null || t1 == null || s1 === s0) return t0;
  return t0 + ((index - s0) / (s1 - s0)) * (t1 - t0);
}

/** The end of the activity in elapsed seconds. */
function endOf(track, laps) {
  const last = track ? track.t[track.t.length - 1] : 0;
  const step = track && track.t.length > 1 ? track.t[track.t.length - 1] - track.t[track.t.length - 2] : 0;
  const fromLaps = laps.reduce((n, l) => n + (l.elapsed ?? 0), 0);
  return Math.max(last + step, track ? 0 : fromLaps);
}

/** Lap start times (elapsed s), each lap's own, plus the end. */
function lapBounds(track, laps, end) {
  if (!laps.length) return [];
  const starts = [];
  let acc = 0;
  for (const l of laps) {
    const fromIndex = track && isNum(l.startIndex) ? timeOfIndex(track, l.startIndex) : null;
    starts.push(isNum(fromIndex) ? fromIndex : acc);
    acc += l.elapsed ?? 0;
  }
  return [...starts, end];
}

/** Time-weighted mean of `key` over [s, e) (points inside it), or null. */
function meanOver(track, key, s, e, skip = 0) {
  const vals = track?.[key];
  if (!vals) return null;
  const { t } = track;
  let sum = 0;
  let wsum = 0;
  const typical = t.length > 2 ? (t[t.length - 1] - t[0]) / (t.length - 1) : 1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] < s + skip || t[i] >= e) continue;
    const v = vals[i];
    if (!isNum(v)) continue;
    const dt = Math.min((t[i + 1] ?? t[i] + typical) - t[i], typical * 3);
    sum += v * dt;
    wsum += dt;
  }
  return wsum > 0 ? sum / wsum : null;
}

function maxOver(track, key, s, e) {
  const vals = track?.[key];
  if (!vals) return null;
  let m = null;
  for (let i = 0; i < track.t.length; i++) if (track.t[i] >= s && track.t[i] < e && isNum(vals[i])) m = m == null ? vals[i] : Math.max(m, vals[i]);
  return m;
}

/** Share (0–1) of the time over [s, e) that `key` was within [lo, hi]; null without data. */
function shareWithin(track, key, s, e, lo, hi, skip = 0) {
  const vals = track?.[key];
  if (!vals) return null;
  const { t } = track;
  const typical = t.length > 2 ? (t[t.length - 1] - t[0]) / (t.length - 1) : 1;
  let inside = 0;
  let all = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] < s + skip || t[i] >= e || !isNum(vals[i])) continue;
    const dt = Math.min((t[i + 1] ?? t[i] + typical) - t[i], typical * 3);
    all += dt;
    if (vals[i] >= lo && vals[i] <= hi) inside += dt;
  }
  return all > 0 ? inside / all : null;
}

/** Distance (m) at an elapsed second, interpolated. */
function distanceAt(track, time) {
  if (!track?.d) return null;
  const { t, d } = track;
  let prev = null;
  for (let i = 0; i < t.length; i++) {
    if (!isNum(d[i])) continue;
    if (t[i] >= time) {
      if (!prev) return d[i];
      const f = (time - prev.t) / (t[i] - prev.t || 1);
      return prev.d + f * (d[i] - prev.d);
    }
    prev = { t: t[i], d: d[i] };
  }
  return prev?.d ?? null;
}

/** The elapsed second at which the distance reaches `meters`, or null. */
function timeAtDistance(track, meters) {
  if (!track?.d) return null;
  const { t, d } = track;
  for (let i = 0; i < t.length; i++) if (isNum(d[i]) && d[i] >= meters) return t[i];
  return null;
}

// ----- Laying the plan over the activity -----

/**
 * The stretch of the activity each planned step covers: [start, end) in elapsed seconds, with how it was found.
 * 1. Laps: a step's end is snapped to a lap boundary near the planned time (a watch running the workout laps each
 *    step). 2. Pattern: when the laps don't fit, the first repeat is found by sliding its on/off pattern over the
 *    speed (or power) and the warm-up stretches to meet it. 3. Clock: the planned times from the start.
 */
export function alignSteps(steps, { track, laps = [], paceS = 330, sport = 'run' }) {
  const end = endOf(track, laps);
  const bounds = lapBounds(track, laps, end);
  const plannedS = steps.map((p) => plannedSeconds(p.step, paceS));

  const walk = (startAt, from = 0, snap = true) => {
    const segs = [];
    let c = startAt;
    let snapped = 0;
    let eligible = 0;
    for (let i = from; i < steps.length; i++) {
      const s = steps[i].step;
      const D = plannedS[i];
      if (c >= end - 5) {
        segs.push({ start: end, end: end, snapped: false });
        continue;
      }
      let e = null;
      let didSnap = false;
      if (s.duration?.type === 'distance' && track?.d) {
        const d0 = distanceAt(track, c) ?? 0;
        e = timeAtDistance(track, d0 + s.duration.m) ?? end;
      } else if (s.duration?.type === 'lap') {
        e = bounds.find((b) => b > c + 5) ?? end;
        didSnap = bounds.length > 0;
      } else {
        e = c + D;
      }
      if (snap && bounds.length && s.duration?.type !== 'lap') {
        eligible++;
        const tol = Math.min(45, Math.max(10, D * 0.1));
        let best = null;
        for (const b of bounds) if (b > c + D * 0.5 && Math.abs(b - e) <= tol && (best == null || Math.abs(b - e) < Math.abs(best - e))) best = b;
        if (best != null) {
          e = best;
          didSnap = true;
          snapped++;
        }
      }
      e = Math.min(e, end);
      segs.push({ start: c, end: e, snapped: didSnap });
      c = e;
    }
    return { segs, snapRate: eligible ? snapped / eligible : 0 };
  };

  const byLaps = walk(0);
  if (bounds.length > 2 && byLaps.snapRate >= 0.6) return { mode: 'laps', segments: byLaps.segs, end };

  const pattern = patternStart(steps, plannedS, track, sport);
  if (pattern) {
    const { blockFirst, offset } = pattern;
    const before = steps.slice(0, blockFirst);
    const plannedBefore = plannedS.slice(0, blockFirst).reduce((n, x) => n + x, 0);
    const segs = [];
    let c = 0;
    // The steps before the first repeat share the time up to it; the last of them takes the difference.
    before.forEach((_, i) => {
      const e = i === before.length - 1 ? offset : Math.min(offset, c + plannedS[i] * (offset / Math.max(1, plannedBefore)));
      segs.push({ start: c, end: Math.min(e, end), snapped: false });
      c = e;
    });
    const rest = walk(offset, blockFirst, false).segs;
    return { mode: 'pattern', segments: [...segs, ...rest], end };
  }
  return { mode: 'time', segments: walk(0, 0, false).segs, end };
}

/** Where the first repeat starts, by sliding its work/easy pattern over the speed or power; null when it can't tell. */
function patternStart(steps, plannedS, track, sport) {
  const key = sport === 'ride' ? (track?.w ? 'w' : track?.v ? 'v' : null) : track?.gap ? 'gap' : track?.v ? 'v' : null;
  if (!key) return null;
  const blockFirst = steps.findIndex((p) => p.block != null);
  if (blockFirst < 0) return null;
  const block = steps[blockFirst].block;
  const parts = [];
  let off = 0;
  for (let i = blockFirst; i < steps.length && steps[i].block === block; i++) {
    parts.push({ from: off, to: off + plannedS[i], work: steps[i].step.kind === 'work' });
    off += plannedS[i];
  }
  if (!parts.some((p) => p.work) || !parts.some((p) => !p.work) || off <= 0) return null;
  const plannedStart = plannedS.slice(0, blockFirst).reduce((n, x) => n + x, 0);
  const last = track.t[track.t.length - 1];
  let best = null;
  for (let o = Math.max(0, plannedStart - 600); o <= Math.min(plannedStart + 1200, last - off * 0.6); o += 5) {
    let hard = 0;
    let hardN = 0;
    let easy = 0;
    let easyN = 0;
    for (const p of parts) {
      const m = meanOver(track, key, o + p.from, o + p.to);
      if (m == null) continue;
      if (p.work) { hard += m; hardN++; } else { easy += m; easyN++; }
    }
    if (!hardN || !easyN) continue;
    const contrast = hard / hardN - easy / easyN;
    // Near the planned start wins a close call: a jogged first rep, or a fast finish, can fit the pattern one rep off.
    const fit = contrast / (easy / easyN) - (0.006 * Math.abs(o - plannedStart)) / 60;
    if (best == null || fit > best.fit) best = { offset: o, contrast, fit, easy: easy / easyN };
  }
  // A real interval pattern: the work at least 8 % faster (or harder) than the easy parts.
  if (!best || best.easy <= 0 || best.contrast / best.easy < 0.08) return null;
  return { blockFirst, offset: best.offset };
}

// ----- Judging each step -----

/** The step's target in absolute units: { key, lo, hi, unit } for heart rate, power or pace; null when open. */
function targetRange(s, anchors) {
  const t = s.target;
  if (!t || t.type === 'open') return null;
  if (t.type === 'hr') return { key: 'hr', lo: (t.low * anchors.lthr) / 100, hi: (t.high * anchors.lthr) / 100, unit: 'bpm' };
  if (t.type === 'power') return { key: 'w', lo: (t.low * anchors.ftp) / 100, hi: (t.high * anchors.ftp) / 100, unit: 'W' };
  if (t.type === 'pace') return { key: 'pace', lo: t.low, hi: t.high, unit: '/km' };
  return null;
}

/** The lap aggregate of the laps that exactly cover [start, end), or null. */
function lapsCovering(laps, bounds, start, end) {
  if (!laps.length) return null;
  const i = bounds.findIndex((b) => Math.abs(b - start) < 1.5);
  const j = bounds.findIndex((b) => Math.abs(b - end) < 1.5);
  if (i < 0 || j <= i) return null;
  const ls = laps.slice(i, j);
  const moving = ls.reduce((n, l) => n + (l.moving || l.elapsed || 0), 0);
  const distance = ls.reduce((n, l) => n + (l.distance ?? 0), 0);
  const wmean = (k) => {
    let s = 0;
    let w = 0;
    for (const l of ls) if (isNum(l[k])) { const x = l.moving || l.elapsed || 0; s += l[k] * x; w += x; }
    return w ? s / w : null;
  };
  const maxHr = ls.reduce((m, l) => (isNum(l.maxHr) ? Math.max(m ?? 0, l.maxHr) : m), null);
  const elapsed = ls.reduce((n, l) => n + (l.elapsed || l.moving || 0), 0);
  return { elapsed, moving, distance, speed: moving ? distance / moving : null, gapSpeed: wmean('gapSpeed'), hr: wmean('hr'), maxHr, watts: wmean('watts') };
}

/** What was done over one stretch. */
function actualOver(track, laps, bounds, seg, sport) {
  if (seg.end - seg.start <= 0) return { seconds: 0 };
  const lap = lapsCovering(laps, bounds, seg.start, seg.end);
  // The watch's own lap times when the step is its laps; else the stretch on the streams.
  const seconds = lap?.elapsed || seg.end - seg.start;
  const d0 = distanceAt(track, seg.start);
  const d1 = distanceAt(track, seg.end);
  const distance = lap?.distance ?? (isNum(d0) && isNum(d1) ? d1 - d0 : null);
  const speed = lap?.speed ?? (isNum(distance) && seconds > 0 ? distance / seconds : meanOver(track, 'v', seg.start, seg.end));
  const gap = lap?.gapSpeed ?? meanOver(track, 'gap', seg.start, seg.end);
  const hr = lap?.hr ?? meanOver(track, 'hr', seg.start, seg.end);
  const maxHr = lap?.maxHr ?? maxOver(track, 'hr', seg.start, seg.end);
  const tail = Math.min(30, seconds / 3);
  const head = Math.min(20, seconds / 4);
  return {
    seconds,
    distance: round(distance),
    paceS: sport === 'ride' || !(speed > 0.3) ? null : round(1000 / speed),
    gapPaceS: sport === 'ride' || !(gap > 0.3) ? null : round(1000 / gap),
    speed: round(speed, 2),
    hr: round(hr),
    maxHr: round(maxHr),
    hrStart: round(meanOver(track, 'hr', seg.start, seg.start + head)),
    hrEnd: round(meanOver(track, 'hr', seg.end - tail, seg.end)),
    watts: round(lap?.watts ?? meanOver(track, 'w', seg.start, seg.end)),
  };
}

/**
 * The verdict of one step. Heart rate lags, so the first minute of a step after a change of pace is left out of its
 * heart-rate check, and an easy step inside a repeat is judged by being easy (well below the work), not by reaching
 * its zone. A hard step with no number (open, "best sustainable") is judged against the easy steps around it and the
 * threshold: a rep that is barely faster than the recoveries was not hard.
 */
function judge(p, a, ctx) {
  const s = p.step;
  const planned = ctx.plannedS;
  if (!a.seconds || a.seconds < Math.min(20, planned * 0.2)) return { verdict: 'missed', inTarget: null };
  if (planned > 0 && s.duration?.type === 'time' && a.seconds < planned * 0.8) return { verdict: 'short', inTarget: null };
  const range = targetRange(s, ctx.anchors);
  const work = s.kind === 'work';
  if (!range) {
    if (!work) return { verdict: 'hit', inTarget: null };
    // An open hard step.
    const ref = ctx.easySpeed;
    const sp = ctx.sport === 'ride' ? a.watts : (a.gapPaceS ? 1000 / a.gapPaceS : a.speed);
    const shortRep = planned > 0 && planned <= 45;
    const hrHard = isNum(a.maxHr) && a.maxHr >= ctx.anchors.lthr * 0.97;
    const fastEnough = isNum(sp) && isNum(ref) && sp >= ref * (shortRep ? 1.2 : 1.12);
    const atThreshold = ctx.sport === 'run' && isNum(ctx.anchors.paceS) && isNum(a.gapPaceS ?? a.paceS) && (a.gapPaceS ?? a.paceS) <= ctx.anchors.paceS * 1.03;
    if (fastEnough && (hrHard || atThreshold || shortRep)) return { verdict: 'hit', inTarget: null };
    if (fastEnough || hrHard || atThreshold) return { verdict: 'close', inTarget: null };
    return { verdict: 'easy', inTarget: null };
  }
  const inRepeat = p.block != null;
  if (!work && inRepeat && isNum(ctx.workSpeed)) {
    // Recovery: easy is what counts.
    const sp = ctx.sport === 'ride' ? a.watts : a.speed;
    if (isNum(sp) && sp > ctx.workSpeed * 0.95) return { verdict: 'hard', inTarget: null };
    return { verdict: 'hit', inTarget: null };
  }
  let value;
  let inTarget = null;
  if (range.key === 'pace') {
    value = a.gapPaceS ?? a.paceS;
    if (!isNum(value)) return { verdict: 'hit', inTarget: null };
    if (value >= range.lo && value <= range.hi) return { verdict: 'hit', inTarget: null };
    const off = value < range.lo ? (range.lo - value) / range.lo : (value - range.hi) / range.hi;
    return { verdict: off <= 0.03 ? 'close' : value < range.lo ? 'hard' : 'easy', inTarget: null };
  }
  const skip = range.key === 'hr' && ctx.changed ? Math.min(60, a.seconds * 0.25) : range.key === 'w' ? Math.min(10, a.seconds * 0.1) : 0;
  value = range.key === 'hr' ? meanOver(ctx.track, 'hr', ctx.seg.start, ctx.seg.end, skip) ?? a.hr : a.watts;
  inTarget = shareWithin(ctx.track, range.key, ctx.seg.start, ctx.seg.end, range.lo, range.hi, skip);
  if (!isNum(value)) return { verdict: 'hit', inTarget };
  const lo = range.lo;
  const hi = range.hi;
  if (value >= lo - 1 && value <= hi + 1) return { verdict: 'hit', inTarget };
  const off = value < lo ? (lo - value) / lo : (value - hi) / hi;
  // A main step 3 % out is close. An easy step (warm-up, cool-down) run at up to the top of zone two is close too: an
  // easy jog sits there for most runners, and it does the job of a warm-up.
  if (off <= (work ? 0.03 : 0.08)) return { verdict: 'close', inTarget };
  if (!work && range.key === 'hr' && value <= ctx.anchors.lthr * 0.91) return { verdict: 'close', inTarget };
  return { verdict: value > hi ? 'hard' : 'easy', inTarget };
}

/** The step's target in words: "144–153 bpm", "Hard (best sustainable)", "Easy". */
function targetWords(s, anchors) {
  if (!s.target || s.target.type === 'open') return s.kind === 'work' ? 'Hard' : 'Easy';
  return targetText(s.target, { ...ANCHORS, ftp: anchors.ftp, lthr: anchors.lthr });
}

// ----- Sets and the whole -----

const median = (xs) => {
  const v = xs.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** One repeat's summary: rep by rep, how many hit, how even (CV), the fade first → last, heart-rate recovery. */
function setSummary(rows, sport) {
  const work = rows.filter((r) => r.kind === 'work' && r.verdict !== 'missed');
  // Evenness and fade are about the reps that were run hard; one jogged rep would swamp them.
  const hard = work.filter((r) => r.verdict !== 'easy' && r.verdict !== 'short');
  const easy = rows.filter((r) => r.kind !== 'work' && r.verdict !== 'missed');
  const metric = (r) => (sport === 'ride' ? r.actual.watts : (r.actual.gapPaceS ?? r.actual.paceS));
  const vals = hard.map(metric).filter(isNum);
  const mean = vals.length ? vals.reduce((n, x) => n + x, 0) / vals.length : null;
  const sd = vals.length > 1 ? Math.sqrt(vals.reduce((n, x) => n + (x - mean) ** 2, 0) / (vals.length - 1)) : null;
  const first = vals[0];
  const lastV = vals[vals.length - 1];
  // Fade: + when the last rep was slower (run pace up) or weaker (ride watts down).
  const fade = vals.length > 1 ? (sport === 'ride' ? (first - lastV) / first : (lastV - first) / first) : null;
  const drops = easy.map((r) => (isNum(r.actual.hrStart) && isNum(r.actual.hrEnd) ? r.actual.hrStart - r.actual.hrEnd : null)).filter(isNum);
  const plannedWork = rows.filter((r) => r.kind === 'work').length;
  return {
    label: rows[0]?.setText ?? 'Intervals',
    reps: rows.filter((r) => r.kind === 'work').map((r) => ({
      label: r.label, verdict: r.verdict, paceS: r.actual.paceS ?? null, gapPaceS: r.actual.gapPaceS ?? null,
      watts: r.actual.watts ?? null, hr: r.actual.hr ?? null, maxHr: r.actual.maxHr ?? null, seconds: r.actual.seconds ?? 0,
    })),
    hit: rows.filter((r) => r.kind === 'work' && r.verdict === 'hit').length,
    total: plannedWork,
    avgPaceS: sport === 'ride' ? null : round(mean),
    avgWatts: sport === 'ride' ? round(mean) : null,
    cvPct: isNum(sd) && mean ? round((sd / mean) * 100, 1) : null,
    fadePct: isNum(fade) ? round(fade * 100, 1) : null,
    hrRecoveryBpm: drops.length ? round(drops.reduce((n, x) => n + x, 0) / drops.length) : null,
    peakHr: work.reduce((m, r) => (isNum(r.actual.maxHr) ? Math.max(m ?? 0, r.actual.maxHr) : m), null),
  };
}

/** "5 × 3:00 hard, 3:00 easy" for a top-level repeat. */
function setText(rep, anchors) {
  const inner = (rep.steps ?? []).filter((x) => x.kind !== 'repeat');
  const work = inner.filter((x) => x.kind === 'work');
  const rest = inner.find((x) => x.kind !== 'work');
  const w = work.map((x) => `${stepLength(x)} ${x.target?.type === 'open' || !x.target ? 'hard' : targetWords(x, anchors)}`).join(' + ');
  return `${rep.count} × ${w || 'set'}${rest ? `, ${stepLength(rest)} easy` : ''}`;
}

/**
 * Plan versus done for one activity.
 * @param {{ workout: import('../workouts/steps.mjs').Workout, sport?: 'run' | 'ride', series: any, laps?: any[],
 *   anchors?: { lthr?: number | null, ftp?: number | null, maxHr?: number | null, paceS?: number | null } }} input
 */
export function analyzeAdherence({ workout, sport = workout?.sport ?? 'run', series, laps = [], anchors: given = {} }) {
  if (!workout?.steps?.length) return null;
  const anchors = {
    lthr: given.lthr ?? ANCHORS.lthr,
    ftp: given.ftp ?? ANCHORS.ftp,
    maxHr: given.maxHr ?? ANCHORS.maxHr,
    paceS: given.paceS ?? null,
  };
  const track = trackOf(series);
  if (!track && !laps.length) return null;
  const steps = plannedSteps(workout);
  const paceS = anchors.paceS ? anchors.paceS * 1.25 : 330;
  const { mode, segments, end } = alignSteps(steps, { track, laps, paceS, sport });
  const bounds = lapBounds(track, laps, end);

  const rows = steps.map((p, i) => {
    const seg = segments[i];
    const actual = actualOver(track, laps, bounds, seg, sport);
    return { p, seg, actual, plannedS: plannedSeconds(p.step, paceS) };
  });

  // The speed (or power) of the easy and the work parts of each repeat, for judging open and easy steps.
  const speedOf = (r) => (sport === 'ride' ? r.actual.watts : (r.actual.gapPaceS ? 1000 / r.actual.gapPaceS : r.actual.speed));
  const blockSpeeds = new Map();
  for (const r of rows) {
    if (r.p.block == null || !r.actual.seconds) continue;
    const b = blockSpeeds.get(r.p.block) ?? { easy: [], work: [] };
    (r.p.step.kind === 'work' ? b.work : b.easy).push(speedOf(r));
    blockSpeeds.set(r.p.block, b);
  }
  const allEasy = rows.filter((r) => r.p.step.kind !== 'work' && r.actual.seconds > 60).map(speedOf);

  const out = rows.map((r, i) => {
    const s = r.p.step;
    const b = r.p.block != null ? blockSpeeds.get(r.p.block) : null;
    const prev = rows[i - 1]?.p.step;
    const changed = !prev || prev.kind !== s.kind || JSON.stringify(prev.target) !== JSON.stringify(s.target);
    const { verdict, inTarget } = judge(r.p, r.actual, {
      plannedS: r.plannedS, anchors, sport, track, seg: r.seg, changed,
      easySpeed: median(b?.easy ?? []) ?? median(allEasy),
      workSpeed: median(b?.work ?? []),
    });
    const fromB = track?.t ? track.t.findIndex((t) => t >= r.seg.start) : -1;
    let toB = -1;
    if (track?.t) for (let k = track.t.length - 1; k >= 0; k--) if (track.t[k] < r.seg.end) { toB = k; break; }
    return {
      index: i,
      label: r.p.label,
      kind: s.kind,
      block: r.p.block,
      zone: stepZone(s, sport),
      planned: { seconds: r.plannedS || null, lengthText: stepLength(s), targetText: targetWords(s, anchors), notes: s.notes ?? null },
      actual: r.actual,
      inTargetPct: isNum(inTarget) ? Math.round(inTarget * 100) : null,
      verdict,
      start: round(r.seg.start),
      end: round(r.seg.end),
      fromBucket: fromB >= 0 && toB >= fromB ? fromB : null,
      toBucket: fromB >= 0 && toB >= fromB ? toB : null,
      setText: r.p.block != null ? setText(workout.steps[r.p.block], anchors) : null,
    };
  });

  const sets = [];
  for (const block of [...new Set(out.filter((r) => r.block != null).map((r) => r.block))]) {
    sets.push(setSummary(out.filter((r) => r.block === block), sport));
  }

  // Score: work counts three times as much as the easy parts, each by its planned time.
  let wsum = 0;
  let vsum = 0;
  for (const r of out) {
    const w = (r.kind === 'work' ? 3 : 1) * Math.max(30, r.planned.seconds ?? r.actual.seconds ?? 60);
    wsum += w;
    vsum += w * VALUE[r.verdict];
  }
  const score = wsum ? Math.round((vsum / wsum) * 100) : null;
  const plannedTotal = out.reduce((n, r) => n + (r.planned.seconds ?? 0), 0);
  const lastEnd = out.length ? out[out.length - 1].end : 0;
  const extraS = Math.max(0, Math.round(end - (lastEnd ?? 0)));

  const result = {
    version: ADHERENCE_VERSION,
    sport,
    workout: { name: workout.name, bank: workout.bank ?? null, level: workout.level ?? null },
    alignment: mode,
    score,
    level: score == null ? null : score >= 85 ? 'good' : score >= 60 ? 'partial' : 'off',
    steps: out,
    sets,
    anchors: { lthr: anchors.lthr, ftp: anchors.ftp, paceS: anchors.paceS },
    totals: { plannedS: plannedTotal, actualS: Math.round(end), extraS },
  };
  return { ...result, flags: flagsOf(result) };
}

// ----- Plain-language observations -----

const hrText = (a) => (isNum(a.hr) ? `${a.hr} bpm${isNum(a.maxHr) ? `, max ${a.maxHr}` : ''}` : null);
function effortText(a, sport) {
  if (sport === 'ride') return isNum(a.watts) ? `${a.watts} W` : null;
  return isNum(a.paceS) ? `${paceText(a.paceS)}/km` : null;
}

/** Short sentences on what stands out, from the numbers alone. */
export function flagsOf(r) {
  const flags = [];
  const sport = r.sport;
  for (const s of r.steps) {
    const what = [effortText(s.actual, sport), hrText(s.actual)].filter(Boolean).join(', ');
    if (s.verdict === 'missed') flags.push(`${s.label} (${s.planned.lengthText}) was not done.`);
    else if (s.verdict === 'short') flags.push(`${s.label} was cut short: ${clockText(s.actual.seconds)} of ${clockText(s.planned.seconds)}.`);
    else if (s.kind === 'work' && s.verdict === 'easy') flags.push(`${s.label} was too easy for "${s.planned.targetText}" (${what}).`);
    else if (s.kind === 'work' && s.verdict === 'hard' && s.block == null) flags.push(`${s.label} ran above its ${s.planned.targetText} target (${what}).`);
    else if (s.kind === 'work' && s.verdict === 'close' && s.block == null) flags.push(`${s.label} was a little off its ${s.planned.targetText} target (${what}).`);
    else if (s.kind !== 'work' && s.verdict === 'hard' && s.block != null) flags.push(`${s.label} was not easy (${what}): the recovery ran close to the work.`);
  }
  for (const set of r.sets) {
    if (set.total) flags.push(`${set.label}: ${set.hit} of ${set.total} reps on target.`);
    if (isNum(set.fadePct) && Math.abs(set.fadePct) >= 3) {
      flags.push(set.fadePct > 0 ? `The reps faded ${set.fadePct} % from first to last.` : `The reps got ${Math.abs(set.fadePct)} % faster from first to last.`);
    }
    if (isNum(set.cvPct) && set.cvPct >= 5) flags.push(`The reps were uneven (${set.cvPct} % spread).`);
    if (isNum(set.hrRecoveryBpm)) {
      flags.push(set.hrRecoveryBpm > 0 ? `Heart rate dropped ${set.hrRecoveryBpm} bpm on average over each recovery.` : 'Heart rate did not come down during the recoveries.');
    }
  }
  if (r.totals.extraS >= 120) flags.push(`${clockText(r.totals.extraS)} more after the planned steps.`);
  return flags;
}
