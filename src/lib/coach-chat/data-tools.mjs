// @ts-check
// Read tools for the Coach chat (lift/COACH-CHAT.md, "Looking things up"): Claude asks for an activity's splits, laps,
// best efforts and zones, a list of activities, his bests, or his training load, and the server answers with text
// from the database. Before these, the chat only had the profile's one-line summaries, so it told Paolo "my data has
// no splits" about a run whose splits were stored (2026-10-31). Pure: the tool definitions, the input checks and the
// text each tool answers with. data.ts runs the reads.

import { addDays, sportOfStrava } from '../plan/week.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** The widest range find_activities lists, and the most rows it answers with. */
export const FIND_MAX_DAYS = 120;
export const FIND_MAX_ROWS = 40;
/** Weeks get_load covers at most. */
export const LOAD_MAX_WEEKS = 26;

export const ACTIVITY_TOOL = {
  name: 'get_activity',
  description:
    "Read one of Paolo's recorded activities in full: km splits (pace, grade-adjusted pace, HR), laps, first vs " +
    'second half, best efforts inside it (fastest 1 km, 5 km, 10 km…) ranked against his history, HR and power ' +
    'zones, the watch\'s training effect, weather, the planned workout it completed, and earlier runs on the same ' +
    'route. Use it before you judge a session ("was that a good test", "how fast was the 5k part", "why was my HR ' +
    'high"). ref: the activity id from <plan> (done workouts) or find_activities, "latest", or a YYYY-MM-DD day ' +
    '(that day\'s longest activity; add sport to pick one).',
  input_schema: {
    type: 'object',
    properties: {
      ref: { type: 'string', description: 'An activity id, "latest", or YYYY-MM-DD.' },
      sport: { type: 'string', enum: ['run', 'ride', 'swim', 'strength', 'walk', 'hike', 'other'], description: 'With a day: which sport.' },
    },
    required: ['ref'],
  },
};

export const FIND_TOOL = {
  name: 'find_activities',
  description:
    'List his recorded activities between two days (at most 120 days apart), newest first: id, day, sport, name, ' +
    'distance, time, pace or power, HR and TSS. Use it to find an activity to read with get_activity, or to compare ' +
    'sessions ("my last three long runs", "every ride this month").',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'YYYY-MM-DD, first day.' },
      to: { type: 'string', description: 'YYYY-MM-DD, last day (default today).' },
      sport: { type: 'string', enum: ['run', 'ride', 'swim', 'strength', 'walk', 'hike', 'other'] },
    },
    required: ['from'],
  },
};

export const BESTS_TOOL = {
  name: 'get_bests',
  description:
    'His best run times (1 km, 5 km, 10 km, half) and best ride power (5 s to 60 min), all time, last 90 days and ' +
    'last 28 days, with the day and activity id of each. Use it for "is that a PR", "what\'s my 5k", "how fit am I ' +
    'compared to last year", and to set test or race paces.',
  input_schema: { type: 'object', properties: {} },
};

export const LOAD_TOOL = {
  name: 'get_load',
  description:
    'His training load by week: TSS, hours by sport, and fitness (CTL), fatigue (ATL) and form (TSB) at the end ' +
    'of each week, with the ramp per week, plus today. Use it for "how did my load look", "am I building", "too ' +
    'much this week?". weeks: 1 to 26 (default 8).',
  input_schema: {
    type: 'object',
    properties: { weeks: { type: 'integer', minimum: 1, maximum: LOAD_MAX_WEEKS } },
  },
};

export const DATA_TOOLS = [ACTIVITY_TOOL, FIND_TOOL, BESTS_TOOL, LOAD_TOOL];
export const DATA_TOOL_NAMES = DATA_TOOLS.map((t) => t.name);

/**
 * @typedef {{ tool: 'get_activity', ref: string, sport: string | null }
 *   | { tool: 'find_activities', from: string, to: string, sport: string | null }
 *   | { tool: 'get_bests' }
 *   | { tool: 'get_load', weeks: number }} DataCall
 */

/**
 * A read tool's input, checked.
 * @param {string} name @param {any} input @param {string} today
 * @returns {{ ok: true, value: DataCall } | { ok: false, problem: string }}
 */
export function checkDataCall(name, input, today) {
  const sport = typeof input?.sport === 'string' && input.sport ? input.sport : null;
  if (name === ACTIVITY_TOOL.name) {
    const ref = typeof input?.ref === 'string' ? input.ref.trim() : '';
    if (!ref) return { ok: false, problem: 'ref is missing: an activity id, "latest" or YYYY-MM-DD' };
    if (!(ref === 'latest' || DATE.test(ref) || /^[\w-]{1,40}$/.test(ref))) return { ok: false, problem: `ref ${ref.slice(0, 40)} is not an activity id, "latest" or YYYY-MM-DD` };
    if (DATE.test(ref) && ref > today) return { ok: false, problem: `${ref} is in the future` };
    return { ok: true, value: { tool: 'get_activity', ref, sport } };
  }
  if (name === FIND_TOOL.name) {
    const from = String(input?.from ?? '');
    const to = input?.to ? String(input.to) : today;
    if (!DATE.test(from) || !DATE.test(to)) return { ok: false, problem: 'from and to must be YYYY-MM-DD' };
    if (from > to) return { ok: false, problem: 'from is after to' };
    if (addDays(from, FIND_MAX_DAYS) < to) return { ok: false, problem: `at most ${FIND_MAX_DAYS} days per call` };
    return { ok: true, value: { tool: 'find_activities', from, to, sport } };
  }
  if (name === BESTS_TOOL.name) return { ok: true, value: { tool: 'get_bests' } };
  if (name === LOAD_TOOL.name) {
    const w = Math.round(Number(input?.weeks ?? 8));
    return { ok: true, value: { tool: 'get_load', weeks: Number.isFinite(w) ? Math.min(LOAD_MAX_WEEKS, Math.max(1, w)) : 8 } };
  }
  return { ok: false, problem: 'unknown tool' };
}

// ----- Number formats -----

/** Seconds as h:mm:ss or m:ss. @param {number | null | undefined} s */
export function clock(s) {
  if (s == null || !Number.isFinite(s)) return '–';
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
/** Pace per km for a speed in m/s. @param {number | null | undefined} v */
export const paceOf = (v) => (v != null && v > 0.3 ? `${clock(1000 / v)}/km` : '–');
/** @param {number | null | undefined} n @param {number} [d] */
const fx = (n, d = 0) => (n == null || !Number.isFinite(n) ? '–' : Number(n).toFixed(d));
/** @param {number} m */
const kmText = (m) => `${(m / 1000).toFixed(m >= 100_000 ? 0 : 2)} km`;
/** @param {number | null | undefined} n */
const signed = (n, d = 1) => (n == null || !Number.isFinite(n) ? '–' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}`);
/** @param {string} day */
const weekday = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/** Whether a Strava sport type is the sport asked for. @param {string} sportType @param {string | null} sport */
export const sportMatches = (sportType, sport) => !sport || sportOfStrava(sportType) === sport;

// ----- get_activity -----

/**
 * @typedef {{ index: number, distance: number, moving: number, elapsed: number, speed: number | null, gapSpeed: number | null,
 *   elevDiff?: number | null, elevGain?: number | null, hr: number | null, maxHr?: number | null, watts?: number | null, name?: string }} SplitLike
 * @typedef {{ span: number, metric: string, value: number, day: string, activityId: string }} PeakRow
 */

/**
 * The first and second half of a foot activity by distance, from its km splits: pace, HR, and the drift (aerobic
 * decoupling: how much the pace per heartbeat fell, positive = it fell). Null without HR or with under 4 splits.
 * @param {SplitLike[]} splits
 */
export function halves(splits) {
  const full = splits.filter((s) => s.distance >= 500 && s.moving > 0);
  if (full.length < 4) return null;
  const mid = Math.floor(full.length / 2);
  /** @param {SplitLike[]} xs */
  const part = (xs) => {
    const d = xs.reduce((a, s) => a + s.distance, 0);
    const t = xs.reduce((a, s) => a + s.moving, 0);
    const hrXs = xs.filter((s) => s.hr != null);
    const hr = hrXs.length === xs.length ? xs.reduce((a, s) => a + /** @type {number} */ (s.hr) * s.moving, 0) / t : null;
    return { speed: d / t, hr, distance: d, moving: t };
  };
  const a = part(full.slice(0, mid));
  const b = part(full.slice(mid));
  const drift = a.hr && b.hr ? ((a.speed / a.hr - b.speed / b.hr) / (a.speed / a.hr)) * 100 : null;
  return { first: a, second: b, paceDelta: 1000 / b.speed - 1000 / a.speed, drift };
}

/** Laps worth listing: not just the watch's 1 km auto-laps (the splits already show those). @param {SplitLike[]} laps */
export function manualLaps(laps) {
  if (laps.length < 2) return [];
  const auto = laps.slice(0, -1).every((l) => Math.abs(l.distance - 1000) <= 15 || Math.abs(l.distance - 1609.3) <= 15);
  return auto ? [] : laps;
}

/**
 * Where each of this activity's peaks ranks in his history: among his efforts in the 365 days before it, and all time.
 * @param {PeakRow[]} own  this activity's peaks
 * @param {PeakRow[]} all  every peak of the same metrics (his history, this activity included)
 * @param {string} day  the activity's day
 */
export function peakRanks(own, all, day) {
  const yearAgo = addDays(day, -365);
  return own.map((p) => {
    const better = (/** @type {PeakRow} */ r) => (p.metric === 'power' ? r.value > p.value : r.value < p.value);
    const same = all.filter((r) => r.metric === p.metric && r.span === p.span && r.activityId !== p.activityId && r.day <= day);
    const year = same.filter((r) => r.day >= yearAgo);
    const bestOf = (/** @type {PeakRow[]} */ xs) => xs.reduce((/** @type {PeakRow | null} */ b, r) => (!b || (p.metric === 'power' ? r.value > b.value : r.value < b.value) ? r : b), null);
    return {
      ...p,
      yearRank: year.filter(better).length + 1,
      yearCount: year.length + 1,
      allRank: same.filter(better).length + 1,
      yearBest: bestOf(year),
      allBest: bestOf(same),
    };
  });
}

/** @param {number} span @param {string} metric */
const spanLabel = (span, metric) =>
  metric === 'power' ? (span < 60 ? `${span} s` : `${span / 60} min`) : span === 21097 ? 'half marathon' : `${span / 1000} km`;
/** @param {number} value @param {string} metric @param {number} span */
const peakValue = (value, metric, span) => (metric === 'power' ? `${Math.round(value)} W` : `${clock(value)} (${clock((value * 1000) / span)}/km)`);

/**
 * get_activity's answer: the activity as plain text lines, everything Claude needs to judge it.
 * @param {any} v  ActivityView (src/lib/activity/queries.ts)
 * @param {any} ctx  ActivityContext (planned, load, garmin, sameRoute)
 * @param {ReturnType<typeof peakRanks>} ranks
 * @param {{ thresholdHr?: number | null }} [opts]
 */
export function activityBrief(v, ctx, ranks, opts = {}) {
  const st = v.stats ?? {};
  const foot = v.layout === 'run';
  const ride = v.layout === 'ride';
  /** @type {string[]} */
  const out = [];
  const time = String(v.startLocal ?? '').slice(11, 16);
  out.push(`Activity ${v.stravaId}: "${v.name}" (${v.sportType}${v.trainer ? ', indoor' : ''}), ${weekday(v.day)} ${v.day} ${time}${v.place ? `, ${v.place}` : ''}`);
  if (v.description) out.push(`His note on it: ${String(v.description).slice(0, 300)}`);

  const main = [
    st.distance ? kmText(st.distance) : null,
    `moving ${clock(st.moving)}${st.elapsed > st.moving + 60 ? ` (elapsed ${clock(st.elapsed)}: ${clock(st.elapsed - st.moving)} stopped)` : ''}`,
    st.elevGain ? `+${Math.round(st.elevGain)} m` : null,
    foot && st.avgSpeed ? `avg pace ${paceOf(st.avgSpeed)}${st.avgGapSpeed ? ` (grade-adjusted ${paceOf(st.avgGapSpeed)})` : ''}` : null,
    !foot && st.avgSpeed ? `avg ${(st.avgSpeed * 3.6).toFixed(1)} km/h` : null,
    st.avgHr ? `HR avg ${Math.round(st.avgHr)}, max ${st.maxHr ?? '–'}` : 'no HR',
    st.avgCadence ? `cadence ${Math.round(st.avgCadence)}` : null,
    ride && st.avgWatts ? `power avg ${Math.round(st.avgWatts)} W${st.np ? `, NP ${Math.round(st.np)} W` : ''}${st.deviceWatts ? '' : ' (estimated)'}` : null,
    ride && st.np && v.effort?.ftp ? `IF ${(st.np / v.effort.ftp).toFixed(2)} (FTP ${v.effort.ftp} W)` : null,
  ].filter(Boolean);
  out.push(main.join(' · '));
  const e = v.effort ?? {};
  const effortBits = [
    e.tss != null ? `TSS ${Math.round(e.tss)}${e.tssMethod ? ` (${e.tssMethod})` : ''}` : null,
    e.sufferScore != null ? `Strava relative effort ${e.sufferScore}` : null,
    st.perceivedExertion != null ? `his RPE ${st.perceivedExertion}/10` : null,
    opts.thresholdHr ? `his threshold HR ${opts.thresholdHr}` : null,
  ].filter(Boolean);
  if (effortBits.length) out.push(effortBits.join(' · '));

  const w = v.weather;
  if (w && w.tempC != null) out.push(`Weather: ${Math.round(w.tempC)} °C${w.feelsLikeC != null ? ` (feels ${Math.round(w.feelsLikeC)})` : ''}${w.humidityPct != null ? `, ${Math.round(w.humidityPct)}% humidity` : ''}${w.windKmh != null ? `, wind ${Math.round(w.windKmh)} km/h` : ''}`);

  const p = ctx?.planned;
  if (p) out.push(`Planned workout it completed: ${p.id} "${p.title}"${p.duration ? `, ${p.duration} min` : ''}${p.tss ? `, TSS ${Math.round(p.tss)}` : ''}${p.compliance?.label ? `; done vs plan: ${p.compliance.label}` : ''}`);
  else out.push('Planned workout: none matched.');

  const wv = v.watch;
  if (wv) {
    const bits = [
      wv.aerobicTe != null ? `aerobic TE ${fx(wv.aerobicTe, 1)}` : null,
      wv.anaerobicTe != null ? `anaerobic TE ${fx(wv.anaerobicTe, 1)}` : null,
      wv.teLabel ? `"${wv.teLabel}"` : null,
      wv.load != null ? `Garmin load ${Math.round(wv.load)}` : null,
      wv.vo2max != null ? `VO2max ${fx(wv.vo2max)}` : null,
      wv.performanceCondition != null ? `performance condition ${signed(wv.performanceCondition, 0)}` : null,
      wv.staminaStart != null && wv.staminaEnd != null ? `stamina ${Math.round(wv.staminaStart)}→${Math.round(wv.staminaEnd)}%` : null,
      wv.gctMs != null ? `ground contact ${Math.round(wv.gctMs)} ms` : null,
    ].filter(Boolean);
    if (bits.length) out.push(`Watch (Garmin): ${bits.join(' · ')}`);
  }

  /** @type {SplitLike[]} */
  const splits = Array.isArray(v.splits) ? v.splits : [];
  if (foot && splits.length) {
    out.push('', 'Km splits (moving pace | grade-adjusted | avg HR | elevation):');
    for (const s of splits.slice(0, 60)) {
      const partial = s.distance < 950 ? ` (last ${Math.round(s.distance)} m)` : '';
      out.push(`${s.index}: ${paceOf(s.speed)} | ${paceOf(s.gapSpeed)} | ${s.hr != null ? Math.round(s.hr) : '–'} | ${s.elevDiff != null ? signed(s.elevDiff, 0) + ' m' : '–'}${s.moving < s.elapsed - 15 ? ` | stopped ${clock(s.elapsed - s.moving)}` : ''}${partial}`);
    }
    const h = halves(splits);
    if (h) {
      out.push(
        `Halves: first ${kmText(h.first.distance)} at ${paceOf(h.first.speed)}${h.first.hr ? ` HR ${Math.round(h.first.hr)}` : ''}, ` +
          `second ${kmText(h.second.distance)} at ${paceOf(h.second.speed)}${h.second.hr ? ` HR ${Math.round(h.second.hr)}` : ''} ` +
          `(${h.paceDelta < 0 ? `negative split, ${Math.round(-h.paceDelta)} s/km faster` : `${Math.round(h.paceDelta)} s/km slower`})` +
          (h.drift != null ? `; pace per heartbeat ${h.drift >= 0 ? 'fell' : 'rose'} ${Math.abs(h.drift).toFixed(1)}% (aerobic decoupling; under 5% is steady)` : ''),
      );
    }
  }
  const laps = foot ? manualLaps(v.laps ?? []) : (v.laps ?? []).length > 1 ? v.laps : [];
  if (laps.length) {
    out.push('', `Laps (${laps.length}):`);
    for (const l of laps.slice(0, 40)) {
      out.push(`${l.index}${l.name && !/^Lap \d+$/.test(l.name) ? ` ${l.name}` : ''}: ${kmText(l.distance)} in ${clock(l.moving)}` +
        (foot ? ` at ${paceOf(l.speed)}` : l.speed ? ` at ${(l.speed * 3.6).toFixed(1)} km/h` : '') +
        (l.watts != null ? `, ${Math.round(l.watts)} W` : '') + (l.hr != null ? `, HR ${Math.round(l.hr)}${l.maxHr ? `/${l.maxHr}` : ''}` : ''));
    }
  }

  const efforts = Array.isArray(v.bestEfforts) ? v.bestEfforts : [];
  if (efforts.length) {
    out.push('', `Fastest stretches inside it (${v.bestEffortsSource === 'strava' ? "Strava's best efforts, elapsed time, stops included" : 'from the streams'}):`);
    out.push(efforts.map((/** @type {any} */ x) => `${x.label} ${clock(x.seconds)}${x.prRank ? ` (Strava: his ${x.prRank === 1 ? 'PR' : `#${x.prRank} ever`})` : ''}`).join(' · '));
  }
  if (ranks.length) {
    out.push('', 'Against his history (Coach peaks, moving time):');
    for (const r of ranks) {
      const best = (/** @type {PeakRow | null} */ b) => (b ? `${peakValue(b.value, r.metric, r.span)} on ${b.day} (${b.activityId})` : 'none');
      out.push(`${spanLabel(r.span, r.metric)} ${peakValue(r.value, r.metric, r.span)}: #${r.yearRank} of ${r.yearCount} in the year before it (best ${best(r.yearBest)}), #${r.allRank} all time (best ${best(r.allBest)})`);
    }
  }
  if (Array.isArray(v.powerCurve) && v.powerCurve.length) {
    out.push(`Best power in it: ${v.powerCurve.filter((/** @type {any} */ c) => [5, 60, 300, 1200, 3600].includes(c.seconds)).map((/** @type {any} */ c) => `${spanLabel(c.seconds, 'power')} ${Math.round(c.watts)} W`).join(' · ')}`);
  }

  /** @param {any[]} zs @param {string} unit */
  const zoneLine = (zs, unit) => zs.filter((z) => z.seconds > 0).map((z) => `Z${z.zone} ${z.name} (${z.min}–${z.max > 0 && z.max < 9999 ? z.max : '+'}${unit}) ${Math.round(z.seconds / 60)} min`).join(' · ');
  if (v.hrZones?.some((/** @type {any} */ z) => z.seconds > 0)) out.push('', `HR zones: ${zoneLine(v.hrZones, ' bpm')}`);
  if (v.powerZones?.some((/** @type {any} */ z) => z.seconds > 0)) out.push(`Power zones: ${zoneLine(v.powerZones, ' W')}`);

  const ld = ctx?.load;
  if (ld) out.push('', `Load: day TSS ${Math.round(ld.dayTss)}; fitness (CTL) ${fx(ld.before?.ctl, 1)}→${fx(ld.after.ctl, 1)}, fatigue (ATL) ${fx(ld.before?.atl, 1)}→${fx(ld.after.atl, 1)}, form (TSB) ${signed(ld.before?.tsb)}→${signed(ld.after.tsb)}`);
  const g = ctx?.garmin;
  if (g) {
    const bits = [
      g.sleep_score != null ? `sleep score ${Math.round(g.sleep_score)}` : null,
      g.sleep_total_min != null ? `slept ${clock(g.sleep_total_min * 60).replace(/:\d\d$/, '')} h` : null,
      g.hrv_night_avg_ms != null ? `HRV ${Math.round(g.hrv_night_avg_ms)} ms` : null,
      g.resting_hr_bpm != null ? `resting HR ${Math.round(g.resting_hr_bpm)}` : null,
      g.training_readiness != null ? `readiness ${Math.round(g.training_readiness)}` : null,
      g.body_battery_high != null ? `Body Battery high ${Math.round(g.body_battery_high)}` : null,
    ].filter(Boolean);
    if (bits.length) out.push(`That morning: ${bits.join(' · ')}`);
  }
  const same = Array.isArray(ctx?.sameRoute) ? ctx.sameRoute : [];
  if (same.length) {
    out.push(`Same route before: ${same.slice(0, 5).map((/** @type {any} */ r) => `${r.day} ${clock(r.moving)}${r.distance ? ` (${paceOf(r.distance / r.moving)})` : ''}`).join(' · ')}`);
  }
  if (v.fetch?.needed) out.push('Note: some details of this activity are still being imported.');
  return out.join('\n');
}

// ----- find_activities -----

/**
 * @typedef {{ strava_activity_id: string, day: string, time: string, name: string | null, sport_type: string | null,
 *   distance: number | null, moving_time: number | null, average_speed: number | null, average_heartrate: number | null,
 *   weighted_average_watts: number | null, average_watts: number | null, tss: number | null, total_elevation_gain: number | null }} FoundRow
 */

/** find_activities' answer. @param {FoundRow[]} rows  newest first @param {{ from: string, to: string, sport: string | null }} q */
export function activitiesList(rows, q) {
  const xs = rows.filter((r) => sportMatches(String(r.sport_type ?? ''), q.sport));
  if (!xs.length) return `No ${q.sport ?? ''} activities from ${q.from} to ${q.to}.`.replace('  ', ' ');
  const lines = xs.slice(0, FIND_MAX_ROWS).map((r) => {
    const sport = sportOfStrava(r.sport_type);
    const foot = sport === 'run' || sport === 'walk' || sport === 'hike';
    const bits = [
      r.distance ? kmText(Number(r.distance)) : null,
      clock(Number(r.moving_time ?? 0)),
      foot && r.average_speed ? paceOf(Number(r.average_speed)) : null,
      sport === 'ride' && r.weighted_average_watts ? `NP ${Math.round(Number(r.weighted_average_watts))} W` : null,
      r.total_elevation_gain && Number(r.total_elevation_gain) > 50 ? `+${Math.round(Number(r.total_elevation_gain))} m` : null,
      r.average_heartrate ? `HR ${Math.round(Number(r.average_heartrate))}` : null,
      r.tss != null ? `TSS ${Math.round(Number(r.tss))}` : null,
    ].filter(Boolean);
    return `${r.strava_activity_id}  ${weekday(r.day)} ${r.day} ${r.time}  ${r.sport_type} "${r.name ?? ''}"  ${bits.join(', ')}`;
  });
  const more = xs.length > FIND_MAX_ROWS ? `\n(${xs.length - FIND_MAX_ROWS} older ones not listed: narrow the dates.)` : '';
  return lines.join('\n') + more;
}

// ----- get_bests -----

/**
 * get_bests' answer, from loadPeakPerformances (src/lib/performance/peaks.ts).
 * @param {{ run: any[], power: any[], pending?: number }} p
 */
export function bestsText(p) {
  /** @param {any} c @param {string} metric @param {number} span */
  const cell = (c, metric, span) => (c ? `${peakValue(c.value, metric, span)} ${c.date} (${c.activityId})` : '–');
  /** @param {any[]} rows @param {string} metric */
  const table = (rows, metric) =>
    rows.map((r) => `${spanLabel(r.span, metric)}: all time ${cell(r.cells.all, metric, r.span)} | 90 d ${cell(r.cells.d90, metric, r.span)} | 28 d ${cell(r.cells.d28, metric, r.span)}`).join('\n');
  const out = ['Run, fastest time over each distance (moving, from GPS streams):', table(p.run ?? [], 'run'), '', 'Ride, best power:', table(p.power ?? [], 'power')];
  if (p.pending) out.push(`(${p.pending} older activities are not scanned yet.)`);
  return out.join('\n');
}

// ----- get_load -----

/**
 * @typedef {{ date: string, ctl: number, atl: number, tsb: number, tss: number }} LoadDay
 * @typedef {{ day: string, sport_type: string | null, moving_time: number | null }} LoadAct
 */

/**
 * get_load's answer: one line per week (Monday first) and today.
 * @param {LoadDay[]} days  oldest first @param {LoadAct[]} acts @param {string} today @param {number} weeks
 */
export function loadText(days, acts, today, weeks) {
  if (!days.length) return 'No training load computed yet.';
  const monday = (/** @type {string} */ d) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const thisMonday = monday(today);
  const byDate = new Map(days.map((d) => [d.date, d]));
  /** @param {string} d */
  const at = (d) => { for (let i = 0; i < 7; i++) { const x = byDate.get(addDays(d, -i)); if (x) return x; } return null; };
  /** @type {string[]} */
  const out = [];
  let prevCtl = at(addDays(thisMonday, -7 * (weeks - 1) - 1))?.ctl ?? null;
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = i === 0 ? today : addDays(start, 6);
    const ds = days.filter((d) => d.date >= start && d.date <= end);
    const tss = ds.reduce((a, d) => a + Number(d.tss || 0), 0);
    const last = at(end);
    /** @type {Record<string, number>} */
    const hours = {};
    for (const a of acts) if (a.day >= start && a.day <= end) {
      const s = sportOfStrava(a.sport_type);
      hours[s] = (hours[s] ?? 0) + Number(a.moving_time ?? 0) / 3600;
    }
    const total = Object.values(hours).reduce((a, b) => a + b, 0);
    const sports = Object.entries(hours).sort((a, b) => b[1] - a[1]).map(([s, h]) => `${s} ${h.toFixed(1)}`).join(', ');
    const ramp = last && prevCtl != null ? last.ctl - prevCtl : null;
    out.push(
      `Week of ${start}${i === 0 ? ' (this week, so far)' : ''}: TSS ${Math.round(tss)}, ${total.toFixed(1)} h${sports ? ` (${sports})` : ''}` +
        (last ? `; end CTL ${last.ctl.toFixed(1)} (${signed(ramp)}), ATL ${last.atl.toFixed(1)}, TSB ${signed(last.tsb)}` : ''),
    );
    if (last) prevCtl = last.ctl;
  }
  const now = at(today);
  if (now) out.push(`Today: CTL ${now.ctl.toFixed(1)}, ATL ${now.atl.toFixed(1)}, TSB ${signed(now.tsb)}.`);
  out.push('CTL ramp guide: +3 to +6 a week is building, over +8 is risky; TSB below −30 is deep fatigue, +5 to +25 is fresh.');
  return out.join('\n');
}
