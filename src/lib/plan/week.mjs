// Week plan logic for the web week page and the start-page summary. No framework or database imports, so
// node --test can run it (week.test.mjs).
//
// A workout here: { id, date: 'YYYY-MM-DD', title, sport, workoutType, intensity, duration (min), tss,
// description, status: 'planned' | 'skipped' | 'done' (done = marked done by hand), adaptedFrom: object | null, sortOrder }.

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' plus n days. */
export function addDays(key, n) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday of the week that holds `key`. */
export function mondayOf(key) {
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

/** Today as 'YYYY-MM-DD' in an IANA time zone. */
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Sport ids a plan workout can name outright (its activity_type); 'other' and 'rest' fall through to the words. */
const NAMED = new Set(['run', 'ride', 'hike', 'walk', 'swim', 'strength', 'yoga']);

/** A sport id from design/sports.json (run, ride, hike, walk, swim, strength, yoga, rest, other), from a plan
 * workout's sport, type and title. A rest day first (an adapt keeps the old sport), then the sport the plan names,
 * then the workout type ("run-easy", "strength-heavy"), and only then the title's words: "Easy run to the gym" is a
 * run, not a lift, so it never takes the gym's strength recording. */
export function sportOf(w) {
  const t = `${w.workoutType ?? ''} ${w.sport ?? ''} ${w.title ?? ''}`.toLowerCase();
  if (/\brest\b|off day/.test(t) && !/interval/.test(t)) return 'rest';
  const named = String(w.sport ?? '').toLowerCase();
  if (NAMED.has(named)) return named;
  const type = String(w.workoutType ?? '').toLowerCase();
  if (/^run-|-run$/.test(type)) return 'run';
  if (/^ride-|-ride$|-bike$/.test(type)) return 'ride';
  if (/^strength/.test(type)) return 'strength';
  if (/\bski\b/.test(t)) return 'other'; // a ski tour matches Strava's BackcountrySki, which is "other" too
  if (/strength|lift|barbell|dumbbell|gym|squat/.test(t)) return 'strength';
  if (/swim/.test(t)) return 'swim';
  if (/yoga|mobility|stretch/.test(t)) return 'yoga';
  if (/hike|hiking/.test(t)) return 'hike';
  if (/\bwalk/.test(t)) return 'walk';
  if (/\brun|stride|jog/.test(t)) return 'run';
  if (/\bride|bike|cycl|zwift/.test(t)) return 'ride';
  return 'other';
}

/** The same groups for a Strava sport_type. */
export function sportOfStrava(sportType) {
  const t = String(sportType ?? '').toLowerCase();
  if (t.includes('run')) return 'run';
  if (t.includes('ride') || t.includes('cycl')) return 'ride';
  if (t.includes('swim')) return 'swim';
  if (t.includes('hike')) return 'hike';
  if (t.includes('walk')) return 'walk';
  if (/weight|workout|crossfit|strength/.test(t)) return 'strength';
  if (/yoga|pilates/.test(t)) return 'yoga';
  return 'other';
}

/** A long session: over 2 hours, or named long. */
export function isLong(w) {
  return (w.duration ?? 0) > 120 || /long/i.test(`${w.workoutType ?? ''} ${w.title ?? ''}`);
}

/** A quality session: intervals, threshold, tempo, VO2 or a race. */
export function isHard(w) {
  if (['hard', 'threshold', 'vo2', 'quality', 'race', 'tempo'].includes(String(w.intensity ?? '').toLowerCase())) {
    return true;
  }
  return /vo2|threshold|interval|tempo|race|sweet.?spot|test-10k|10k test/i.test(`${w.workoutType ?? ''} ${w.title ?? ''}`);
}

/** Endurance sports: one can stand in for another on the day (a run instead of a spin). */
const CARDIO = new Set(['run', 'ride', 'hike', 'walk', 'swim']);

/** The Strava activity a match holds: the match itself, or the watch activity next to a Lift session. */
export function matchActivityId(match) {
  if (!match) return null;
  return match.source === 'strava' ? match.id : match.activityId ?? null;
}

/**
 * Status for each workout: done (an activity or Lift session on that day matches its sport, or cardio of another
 * sport stands in for it: `swapped`), skipped,
 * missed (a past day with no match), today, or planned. Each activity matches at most one workout. A strength
 * workout matches its Lift session and also the day's Strava strength activity (the watch), as `activityId`.
 *
 * @param {Array<object>} workouts
 * @param {Array<{ id: string, date: string, sport: string, name: string }>} activities  Strava, by local day
 * @param {Array<{ id: string, date: string, name: string }>} liftSessions  Lift sessions, by local day
 * @param {string} today 'YYYY-MM-DD'
 * @returns {Map<string, { status: string, match: object | null }>}
 */
export function matchWeek(workouts, activities, liftSessions, today) {
  const used = new Set();
  const result = new Map();
  const key = (id) => String(id ?? '').toLowerCase();
  // A Lift session linked to a workout (lift_session_id) is that workout's: no other workout of the day claims it.
  const linked = new Set(workouts.map((w) => key(w.liftSessionId)).filter(Boolean));
  // Each workout's own logged session first; then, per day, workouts with no session of their own pick before those
  // whose session has nothing logged (a fresh lift started in Lift goes to the workout that has none).
  const own = new Map();
  for (const w of workouts) {
    const s = key(w.liftSessionId) && liftSessions.find((x) => x.date === w.date && (x.setsLogged ?? 1) > 0 && key(x.id) === key(w.liftSessionId));
    if (s) {
      own.set(w.id, s);
      used.add(`lift:${s.id}`);
    }
  }
  const ordered = [...workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.liftSessionId ? 1 : 0) - (b.liftSessionId ? 1 : 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const matches = new Map();
  for (const w of ordered) {
    const sport = sportOf(w);
    let match = null;
    if (w.status !== 'skipped' && sport !== 'rest') {
      if (sport === 'strength') {
        // A session planned in Lift (scripts/lift-plan.mjs) counts only once a set is logged.
        const lift =
          own.get(w.id) ??
          liftSessions.find((s) => s.date === w.date && (s.setsLogged ?? 1) > 0 && !used.has(`lift:${s.id}`) && !linked.has(key(s.id)));
        if (lift) {
          used.add(`lift:${lift.id}`);
          // The watch records the same lift as a Strava strength activity: claim it too, so it is not shown twice
          // and its time and TSS count as the workout's actual.
          const act = activities.find((a) => a.date === w.date && a.sport === 'strength' && !used.has(`strava:${a.id}`));
          if (act) used.add(`strava:${act.id}`);
          match = { source: 'lift', id: lift.id, name: lift.name, activityId: act?.id ?? null };
        }
      }
      if (!match) {
        const act = activities.find((a) => a.date === w.date && a.sport === sport && !used.has(`strava:${a.id}`));
        if (act) {
          used.add(`strava:${act.id}`);
          match = { source: 'strava', id: act.id, name: act.name };
        }
      }
    }
    matches.set(w.id, match);
  }
  // A swap: cardio of another sport counts for the day's open cardio workout (a run instead of the spin). Only after
  // every same-sport match, so a run never takes a planned run's activity. Never for a lift or a rest day.
  for (const w of ordered) {
    if (matches.get(w.id) || w.status === 'skipped' || w.status === 'done' || !CARDIO.has(sportOf(w))) continue;
    const act = activities.find((a) => a.date === w.date && CARDIO.has(a.sport) && !used.has(`strava:${a.id}`));
    if (act) {
      used.add(`strava:${act.id}`);
      matches.set(w.id, { source: 'strava', id: act.id, name: act.name, swapped: true, sport: act.sport });
    }
  }
  for (const w of ordered) {
    const sport = sportOf(w);
    const match = matches.get(w.id) ?? null;
    let status;
    if (match) status = 'done';
    else if (w.status === 'skipped') status = 'skipped';
    else if (w.status === 'done') status = 'done';
    else if (sport === 'rest') status = w.date < today ? 'done' : w.date === today ? 'today' : 'planned';
    else if (w.date < today) status = 'missed';
    else if (w.date === today) status = 'today';
    else status = 'planned';
    result.set(w.id, { status, match });
  }
  return result;
}

const ADAPT_FIELDS = ['date', 'title', 'intensity', 'duration', 'tss', 'description', 'workoutType', 'status'];

function snapshot(w) {
  return Object.fromEntries(ADAPT_FIELDS.map((k) => [k, w[k] ?? null]));
}

function round5(n) {
  return Math.max(20, Math.round(n / 5) * 5);
}

/**
 * Changes to the rest of the week for how I feel today. Returns [{ id, changes }], where `changes` holds
 * the new field values and `adaptedFrom` (the fields before the first adapt, so undo can restore them).
 *
 * - wrecked: today becomes rest; tomorrow is adapted as for "tired".
 * - tired: a quality session today or tomorrow swaps with an easy day later this week (one not next to
 *   another quality day). With no such day it becomes an easy aerobic session at 60 % of the time.
 *   A strength session today stays, with fewer sets.
 * - ok: nothing.
 * - fresh: undo every adapt from today on.
 *
 * @param {Array<object>} workouts this week's workouts
 * @param {'wrecked' | 'tired' | 'ok' | 'fresh'} feel
 * @param {string} today 'YYYY-MM-DD'
 * @param {{ done?: Set<string> }} [opts] ids of workouts already done (never changed)
 */
export function adaptForFeel(workouts, feel, today, opts = {}) {
  const done = opts.done ?? new Set();
  if (feel === 'fresh') return undoAdapts(workouts, today);
  if (feel !== 'tired' && feel !== 'wrecked') return [];

  // Work on copies so later decisions see earlier moves.
  const week = workouts.map((w) => ({ ...w }));
  const updates = new Map();
  const change = (w, fields) => {
    const prev = updates.get(w.id) ?? { id: w.id, changes: {} };
    if (!w.adaptedFrom && !prev.changes.adaptedFrom) prev.changes.adaptedFrom = snapshot(w);
    Object.assign(prev.changes, fields);
    Object.assign(w, fields);
    updates.set(w.id, prev);
  };
  const open = (w) => !done.has(w.id) && w.status !== 'skipped';
  const weekEnd = addDays(mondayOf(today), 6);
  const tomorrow = addDays(today, 1);

  if (feel === 'wrecked') {
    for (const w of week.filter((x) => x.date === today && open(x) && sportOf(x) !== 'rest')) {
      change(w, {
        title: `Rest (instead of ${w.title})`,
        intensity: 'rest',
        duration: 0,
        tss: 0,
        description: 'Feeling wrecked: rest, sleep and eat well. A 20 min walk is fine.',
        workoutType: 'rest',
      });
    }
  }

  const daysToAdapt = feel === 'wrecked' ? [tomorrow] : [today, tomorrow];
  const hardOn = (day, except) => week.some((x) => x.date === day && x !== except && isHard(x) && x.intensity !== 'rest');

  for (const day of daysToAdapt) {
    if (day > weekEnd) continue;
    for (const w of week.filter((x) => x.date === day && open(x))) {
      if (isHard(w)) {
        // A later easy day this week, with no quality session on the day before or after it.
        let target = null;
        for (let d = addDays(tomorrow, 1); d <= weekEnd; d = addDays(d, 1)) {
          const onDay = week.filter((x) => x.date === d);
          // Keep long sessions (the weekend long ride and long run) where they are.
          if (onDay.some((x) => isHard(x) || done.has(x.id) || isLong(x))) continue;
          if (hardOn(addDays(d, -1), w) || hardOn(addDays(d, 1), w)) continue;
          target = d;
          break;
        }
        if (target) {
          const easy = week.filter((x) => x.date === target && open(x) && !['strength', 'rest'].includes(sportOf(x)));
          for (const e of easy) change(e, { date: day });
          change(w, { date: target });
        } else {
          change(w, {
            title: `Easy aerobic (instead of ${w.title})`,
            intensity: 'easy',
            duration: w.duration ? round5(w.duration * 0.6) : 45,
            tss: w.tss ? Math.round(w.tss * 0.4) : null,
            description: 'Zone 1-2 only, conversational. The quality session comes back when you feel better.',
          });
        }
      } else if (day === today && sportOf(w) === 'strength' && !/lighter/i.test(w.title)) {
        change(w, {
          title: `${w.title} (lighter)`,
          description: `Lighter today: one set fewer per lift, stop 2-3 reps short of failure.\n\n${w.description ?? ''}`.trim(),
        });
      }
    }
  }
  return [...updates.values()];
}

/** Restores every adapted workout dated today or later (by its current or original date). */
export function undoAdapts(workouts, today) {
  return workouts
    .filter((w) => w.adaptedFrom && (w.date >= today || String(w.adaptedFrom.date ?? '') >= today))
    .map((w) => ({ id: w.id, changes: { ...w.adaptedFrom, adaptedFrom: null } }));
}
