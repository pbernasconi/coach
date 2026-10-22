// GET /api/app/weigh-ins/<date | latest> for the Lift app (lift/APP-API.md, "Weigh-in"): one day's weigh-in, what it
// changed, and the 12-week trend. The screen a weigh-in push opens. Pure: the loader (weigh-in-api.ts) reads the rows.

import { latestWithChange } from './garmin-training.mjs';

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/** "Thursday, Oct 22". */
export const dayTitle = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

const shortDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * A change in kg for display. Down is good: the goal is losing fat (COACH.md).
 * @param {number} kg
 */
export function kgChange(kg) {
  const v = r1(kg);
  return {
    kg: v,
    text: `${v < 0 ? '▼' : v > 0 ? '▲' : '±'} ${Math.abs(v).toFixed(1)} kg`,
    tone: v < 0 ? 'good' : v > 0 ? 'bad' : 'neutral',
  };
}

/**
 * The response, or null when the day has no weight.
 * @param {{
 *   date: string,
 *   weights: { date: string, value: number }[],  weight_kg from 83 days before `date` through `date`, oldest first
 *   bodyFat: number | null,  body_fat_pct on `date`
 *   previous: { date: string, value: number } | null,  the last weight before `date`, at any distance
 *   source: string | null,
 *   recordedAt: string | null,  when the day's weight was stored (the last weigh-in that day)
 *   newer: string | null,  the next day with a weight
 *   older: string | null,
 * }} input
 */
export function weighInResponse(input) {
  const today = input.weights.find((w) => w.date === input.date);
  if (!today) return null;
  const upTo = input.weights.filter((w) => w.date <= input.date);
  const four = latestWithChange(upTo, 28);
  const changes = [];
  if (input.previous) {
    const days = Math.round((Date.parse(`${input.date}T00:00:00Z`) - Date.parse(`${input.previous.date}T00:00:00Z`)) / 864e5);
    changes.push({
      id: 'previous',
      label: days === 1 ? 'Since yesterday' : `Since ${shortDay(input.previous.date)}`,
      ...kgChange(today.value - input.previous.value),
      noteText: `${input.previous.value.toFixed(1)} kg on ${shortDay(input.previous.date)}`,
    });
  }
  if (four?.change != null && four.since) {
    changes.push({
      id: '4w',
      label: '4 weeks',
      ...kgChange(four.change),
      noteText: `${(four.change / 4).toFixed(2)} kg a week`,
    });
  }
  return {
    date: input.date,
    dateText: dayTitle(input.date),
    weight: { kg: r2(today.value), text: today.value.toFixed(1), unit: 'kg' },
    bodyFat: input.bodyFat == null ? null : { pct: r1(input.bodyFat), text: `${input.bodyFat.toFixed(1)} %` },
    changes,
    series: upTo.map((w) => ({ date: w.date, kg: r1(w.value) })),
    source: input.source,
    recordedAt: input.recordedAt,
    newerDate: input.newer,
    olderDate: input.older,
  };
}
