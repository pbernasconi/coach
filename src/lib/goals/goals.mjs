import { toDay } from '../db-time.mjs';

// Milestone goals: one measurable target with a deadline, measured from Strava and Garmin data.
// They live in users.settings.goals. The web (Performance, Settings) and /plan (scripts/coach-profile.mjs) use this file.

/**
 * @typedef {'run_10k_pace' | 'ski_4000m' | 'vo2max' | 'ride_km'} GoalKind
 * @typedef {{ id: string; kind: GoalKind; title?: string; target: number; baseline: number; start: string; deadline: string }} Goal
 * @typedef {'done' | 'open' | 'on_track' | 'behind' | 'not_started' | 'missed'} GoalStatus
 * @typedef {Goal & { title: string; current: number | null; progress: number; status: GoalStatus; daysLeft: number; detail: string[] }} GoalProgress
 */

/**
 * Each kind of goal. `lower`: a smaller value is better (pace). `linear`: the total grows at an even rate,
 * so the goal can be on track or behind. Ski peaks come in the spring, so they are not linear.
 */
export const GOAL_KINDS = {
  run_10k_pace: { label: '10k pace', unit: 'min/km', lower: true, linear: false },
  ski_4000m: { label: '4000 m peaks on skis', unit: 'peaks', lower: false, linear: false },
  vo2max: { label: 'VO2 max', unit: 'mL/kg/min', lower: false, linear: false },
  ride_km: { label: 'Ride distance', unit: 'km', lower: false, linear: true },
};

/** Seconds per km as "4:00". */
export function pace(sec) {
  if (sec == null || !Number.isFinite(sec)) return '-';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A value in the goal's unit, as text. */
export function formatValue(kind, v) {
  if (v == null || !Number.isFinite(v)) return '-';
  if (kind === 'run_10k_pace') return `${pace(v)}/km`;
  if (kind === 'ride_km') return `${Math.round(v).toLocaleString('en-US')} km`;
  if (kind === 'ski_4000m') return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

/** Form text to a value: "4:00" → 240 for pace; a number for the other kinds. NaN when the text is not valid. */
export function parseValue(kind, text) {
  const t = String(text ?? '').trim();
  if (kind === 'run_10k_pace') {
    const m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }
  return t === '' ? NaN : Number(t.replace(/,/g, ''));
}

/** The goal as a short sentence, for a goal without a title. */
export function describe(g) {
  if (g.kind === 'run_10k_pace') return `Run 10k at ${pace(g.target)}/km`;
  if (g.kind === 'ski_4000m') return `Ski ${g.target} × 4000 m peaks`;
  if (g.kind === 'vo2max') return `VO2 max ${g.target}`;
  return `Ride ${Math.round(g.target).toLocaleString('en-US')} km`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Only valid goals, with clean fields. Anything else is dropped. */
export function cleanGoals(list) {
  if (!Array.isArray(list)) return [];
  return list.flatMap((g) => {
    if (!g || !(g.kind in GOAL_KINDS)) return [];
    const target = Number(g.target);
    const baseline = Number(g.baseline);
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(baseline) || baseline < 0) return [];
    if (!DATE.test(String(g.start)) || !DATE.test(String(g.deadline)) || g.start > g.deadline) return [];
    const title = String(g.title ?? '').trim().slice(0, 120);
    const id = String(g.id ?? '').trim().slice(0, 40) || Math.random().toString(36).slice(2, 10);
    return [{ id, kind: g.kind, ...(title ? { title } : {}), target, baseline, start: g.start, deadline: g.deadline }];
  });
}

const dayMs = 86_400_000;
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

/**
 * Progress and status of one goal from its measured value. Pure, so it is tested without a database.
 * @param {Goal} g
 * @param {number | null} current
 * @param {string} today YYYY-MM-DD
 * @returns {{ progress: number; status: GoalStatus; daysLeft: number; expected: number | null }}
 */
export function judge(g, current, today) {
  const k = GOAL_KINDS[g.kind];
  const daysLeft = Math.max(0, days(today, g.deadline));
  const span = g.target - g.baseline;
  const raw = current == null ? 0 : span === 0 ? 1 : (current - g.baseline) / span;
  const progress = Math.max(0, Math.min(1, raw));
  const done = current != null && (k.lower ? current <= g.target : current >= g.target);
  const fraction = Math.max(0, Math.min(1, days(g.start, today) / Math.max(1, days(g.start, g.deadline))));
  const expected = k.linear ? g.baseline + span * fraction : null;
  /** @type {GoalStatus} */
  let status = 'open';
  if (done) status = 'done';
  else if (today > g.deadline) status = 'missed';
  else if (today < g.start) status = 'not_started';
  else if (k.linear) status = (current ?? 0) >= /** @type {number} */ (expected) * 0.95 ? 'on_track' : 'behind';
  return { progress, status, daysLeft, expected };
}

const dayText = (v) => toDay(v) ?? '-';
const minDate = (a, b) => (a < b ? a : b);

/**
 * Measures every goal. `sql` is the Neon tagged template (the web's `@/db` sql, or neon() in a script).
 * - run_10k_pace: the fastest average pace of a run of 10 km or more in the last 12 months.
 * - ski_4000m: backcountry ski days with a high point of 4000 m or more, from start to deadline.
 * - vo2max: the newest Garmin VO2 max, the higher of the running and the cycling value.
 * - ride_km: all rides (outdoor, virtual, commute) from start to deadline.
 * @param {any} sql
 * @param {string} userId
 * @param {Goal[]} goals
 * @param {string} today YYYY-MM-DD
 * @returns {Promise<GoalProgress[]>}
 */
export async function measureGoals(sql, userId, goals, today) {
  return Promise.all(goals.map(async (g) => {
    const end = minDate(today, g.deadline);
    /** @type {number | null} */
    let current = null;
    const detail = [];
    if (g.kind === 'run_10k_pace') {
      const yearAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * dayMs).toISOString().slice(0, 10);
      const [[best], [pred]] = await Promise.all([
        sql`
          SELECT to_char(start_date_local, 'YYYY-MM-DD') AS d, name, moving_time / (distance / 1000.0) AS sec_per_km
          FROM strava_activities
          WHERE user_id = ${userId} AND sport_type IN ('Run', 'TrailRun', 'VirtualRun') AND distance >= 9950 AND moving_time > 0
            AND start_date_local >= ${yearAgo}
          ORDER BY sec_per_km LIMIT 1`,
        sql`SELECT value, to_char(date, 'YYYY-MM-DD') AS date FROM health_samples WHERE user_id = ${userId} AND metric = 'race_pred_10k_s' ORDER BY health_samples.date DESC LIMIT 1`,
      ]);
      if (best) {
        current = Number(best.sec_per_km);
        detail.push(`Best 10k+ run in 12 months: ${pace(current)}/km (${best.name}, ${dayText(best.d)})`);
      } else detail.push('No run of 10 km or more in 12 months');
      if (pred) detail.push(`Garmin 10k prediction: ${pace(Number(pred.value) / 10)}/km`);
    } else if (g.kind === 'ski_4000m') {
      const rows = await sql`
        SELECT DISTINCT ON (start_date_local::date, name) to_char(start_date_local, 'YYYY-MM-DD') AS d, name, elev_high
        FROM strava_activities
        WHERE user_id = ${userId} AND sport_type = 'BackcountrySki' AND elev_high >= 4000
          AND start_date_local >= ${g.start} AND start_date_local < ${g.deadline}::date + 1
        ORDER BY start_date_local::date, name`;
      current = rows.length;
      for (const r of rows) detail.push(`${r.name}: ${Math.round(Number(r.elev_high))} m (${dayText(r.d)})`);
      if (rows.length === 0) detail.push(today < g.start ? `The season starts ${g.start}` : 'No 4000 m peak yet this season');
    } else if (g.kind === 'vo2max') {
      const rows = await sql`
        SELECT DISTINCT ON (metric) metric, value, to_char(date, 'YYYY-MM-DD') AS date FROM health_samples
        WHERE user_id = ${userId} AND metric IN ('vo2max', 'vo2max_cycling') ORDER BY metric, health_samples.date DESC`;
      for (const r of rows) {
        const v = Number(r.value);
        if (current == null || v > current) current = v;
        detail.push(`${r.metric === 'vo2max' ? 'Running' : 'Cycling'}: ${Math.round(v * 10) / 10} (${dayText(r.date)})`);
      }
      if (rows.length === 0) detail.push('No Garmin VO2 max yet');
    } else if (g.kind === 'ride_km') {
      const [r] = await sql`
        SELECT COALESCE(sum(distance), 0) / 1000.0 AS km FROM strava_activities
        WHERE user_id = ${userId} AND (sport_type ILIKE '%ride%' OR sport_type ILIKE '%cycl%')
          AND start_date_local >= ${g.start} AND start_date_local < ${end}::date + 1`;
      current = today < g.start ? 0 : Number(r?.km ?? 0);
    }
    const { progress, status, daysLeft, expected } = judge(g, current, today);
    if (g.kind === 'ride_km' && today >= g.start && today <= g.deadline) {
      const weeksLeft = Math.max(1, (daysLeft + 1) / 7);
      detail.push(`Expected by today: ${formatValue('ride_km', expected)}`);
      detail.push(`Needed: ${formatValue('ride_km', Math.max(0, g.target - (current ?? 0)) / weeksLeft)} per week`);
    } else if (g.kind === 'ride_km' && today < g.start) {
      detail.push(`Starts ${g.start}: ${formatValue('ride_km', g.target / ((days(g.start, g.deadline) + 1) / 7))} per week`);
    }
    return { ...g, title: g.title || describe(g), current, progress, status, daysLeft, detail };
  }));
}

/** The goals from users.settings.goals. */
export async function loadGoals(sql, userId) {
  const [u] = await sql`SELECT settings -> 'goals' AS goals FROM users WHERE id = ${userId}`;
  return cleanGoals(u?.goals ?? []);
}

export async function saveGoals(sql, userId, goals) {
  await sql`
    UPDATE users SET settings = jsonb_set(settings, '{goals}', ${JSON.stringify(cleanGoals(goals))}::jsonb), updated_at = NOW()
    WHERE id = ${userId}`;
}

const STATUS_TEXT = { done: 'done', open: 'open', on_track: 'on track', behind: 'behind', not_started: 'not started', missed: 'missed' };

/** One goal as a Markdown line for profile.md. */
export function goalLine(p) {
  const left = p.status === 'done' || p.status === 'missed' ? '' : `, ${p.daysLeft} days left`;
  return `- **${p.title}** by ${p.deadline}: now ${formatValue(p.kind, p.current)} / target ${formatValue(p.kind, p.target)} ` +
    `(baseline ${formatValue(p.kind, p.baseline)}; ${STATUS_TEXT[p.status]}${left}). ${p.detail.join('; ')}`;
}

export { STATUS_TEXT };
