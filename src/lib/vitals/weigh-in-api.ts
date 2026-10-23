import { sql } from '@/db';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { weighInResponse } from './weigh-in-api.mjs';

type Row = Record<string, unknown>;

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** A day ('YYYY-MM-DD') or 'latest'. */
export const WEIGH_IN_DAY = /^(latest|\d{4}-\d{2}-\d{2})$/;

/** GET /api/app/weigh-ins/<date | latest>: one day's weigh-in; null when that day has none. */
export async function loadAppWeighIn(userId: string, day: string) {
  let date = day;
  if (day === 'latest') {
    const [r] = (await sql`
      SELECT to_char(max(date), 'YYYY-MM-DD') AS date FROM health_samples WHERE user_id = ${userId} AND metric = 'weight_kg'`) as Row[];
    if (!r?.date) return null;
    date = String(r.date);
  }
  const [rows, [fat], [prev], [newer]] = await Promise.all([
    sql`
      SELECT date, value, source, updated_at FROM health_samples
      WHERE user_id = ${userId} AND metric = 'weight_kg' AND date >= ${addDays(date, -111)}::date AND date <= ${date}::date
      ORDER BY date` as Promise<Row[]>,
    sql`SELECT value FROM health_samples WHERE user_id = ${userId} AND metric = 'body_fat_pct' AND date = ${date}::date` as Promise<Row[]>,
    sql`
      SELECT date, value FROM health_samples WHERE user_id = ${userId} AND metric = 'weight_kg' AND date < ${date}::date
      ORDER BY date DESC LIMIT 1` as Promise<Row[]>,
    sql`
      SELECT date FROM health_samples WHERE user_id = ${userId} AND metric = 'weight_kg' AND date > ${date}::date
      ORDER BY date LIMIT 1` as Promise<Row[]>,
  ]);
  const weights = rows.flatMap((r) => {
    const d = toDay(r.date);
    return d ? [{ date: d, value: Number(r.value) }] : [];
  });
  const todayRow = rows.find((r) => toDay(r.date) === date);
  return weighInResponse({
    date,
    weights,
    bodyFat: fat ? Number(fat.value) : null,
    previous: prev ? { date: toDay(prev.date)!, value: Number(prev.value) } : null,
    source: todayRow?.source ? String(todayRow.source) : null,
    recordedAt: todayRow ? toIso(todayRow.updated_at) : null,
    newer: newer ? toDay(newer.date) : null,
    older: prev ? toDay(prev.date) : null,
  });
}
