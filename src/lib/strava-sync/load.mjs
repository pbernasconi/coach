// @ts-check
// The daily training load (CTL, ATL, TSB) from the activities' TSS.

import { toDay } from '../db-time.mjs';

const HOME_TIME_ZONE = 'America/Los_Angeles';

/**
 * Rebuilds daily_training_load (CTL/ATL/TSB) from the first activity to today, from strava_activities.tss. The whole
 * history: a TSS change on an old activity changes every day after it. One write for all days.
 */
/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string} userId
 * @param {(...a: unknown[]) => void} [log]
 */
export async function rebuildTrainingLoad(sql, userId, log = console.log) {
  const acts = await sql`
    SELECT start_date_local, tss
    FROM strava_activities
    WHERE user_id = ${userId} AND COALESCE(commute, false) = false AND tss IS NOT NULL
    ORDER BY start_date_local ASC`;
  /** @type {Map<string, number>} */
  const tssByDate = new Map();
  for (const row of acts) {
    const key = toDay(row.start_date_local); // the local day as written; new Date() would shift it by the machine's zone
    if (!key) continue;
    tssByDate.set(key, (tssByDate.get(key) ?? 0) + Number(row.tss));
  }
  if (tssByDate.size === 0) {
    await sql`DELETE FROM daily_training_load WHERE user_id = ${userId}`;
    return;
  }

  // The last day is today on the athlete's wall clock (home, or the newest activity's day when traveling ahead of
  // home), not today in UTC: at 18:00 in San Francisco UTC is already tomorrow, and that empty day lowered TSB.
  const homeToday = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = loadSeries(tssByDate, homeToday);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const lastKey = last.date;

  // Drop days after the last one (an earlier run in UTC could have written tomorrow) and before the first.
  await sql`DELETE FROM daily_training_load WHERE user_id = ${userId} AND (date > ${lastKey} OR date < ${first.date})`;
  await sql`
    INSERT INTO daily_training_load (id, user_id, date, tss, ctl, atl, tsb, computed_at)
    SELECT md5(${userId} || d::text), ${userId}, d, t, c, a, b, NOW()
    FROM unnest(${rows.map((r) => r.date)}::date[], ${rows.map((r) => r.tss)}::real[], ${rows.map((r) => r.ctl)}::real[],
                ${rows.map((r) => r.atl)}::real[], ${rows.map((r) => r.tsb)}::real[]) AS x(d, t, c, a, b)
    ON CONFLICT (user_id, date) DO UPDATE SET
      tss = EXCLUDED.tss, ctl = EXCLUDED.ctl, atl = EXCLUDED.atl, tsb = EXCLUDED.tsb, computed_at = NOW()`;
  log(`Rebuilt daily_training_load: ${rows.length} day rows. Latest: ${last.date} CTL=${last.ctl} ATL=${last.atl} TSB=${last.tsb}`);
}

/**
 * CTL (42-day) and ATL (7-day) for each day from the first day with TSS to `today` (or the last TSS day, if later).
 * @param {Map<string, number>} tssByDate  YYYY-MM-DD → the day's TSS
 * @param {string} today  YYYY-MM-DD
 * @returns {{ date: string, tss: number, ctl: number, atl: number, tsb: number }[]}
 */
export function loadSeries(tssByDate, today) {
  const days = [...tssByDate.keys()].sort();
  const lastKey = [today, days.at(-1)].sort().at(-1);
  const end = new Date(`${lastKey}T00:00:00Z`);
  let ctl = 0;
  let atl = 0;
  const rows = [];
  for (let d = new Date(`${days[0]}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const t = tssByDate.get(k) ?? 0;
    ctl += (t - ctl) / 42;
    atl += (t - atl) / 7;
    const r1 = (/** @type {number} */ x) => Math.round(x * 10) / 10;
    rows.push({ date: k, tss: r1(t), ctl: r1(ctl), atl: r1(atl), tsb: r1(ctl - atl) });
  }
  return rows;
}
