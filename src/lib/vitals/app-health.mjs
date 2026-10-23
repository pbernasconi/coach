// GET /api/app/health (lift/APP-API.md, "Health"): the web's Health page (src/app/(dashboard)/health/page.tsx) as
// display-ready JSON for the Lift app's Today tab. Every text comes from health-view.mjs, which the web components
// also use. Pure: the loader (app-health.ts) reads the data with the web's loaders. node --test (app-health.test.mjs).

import { garminLine } from './garmin.mjs';
import {
  BOARD_CHARTS, dexaChange, fmtDate, fmtDay, hm, isOff, labsSummary, outliersText, verdictOf, vitalCells, weightFoot,
} from './health-view.mjs';

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const roundRange = (r) => (r ? { low: r1(r.low), high: r1(r.high), value: r1(r.value), min: r1(r.min), max: r1(r.max) } : null);
const NIGHT = { off: 'no watch last night', waiting: "waiting for last night's sleep" };

/** The trends the phone draws, in this order (BOARD_CHARTS keys). */
export const TREND_KEYS = ['hrv', 'rhr', 'sleep', 'sleepScore', 'bbHigh', 'readiness', 'stress', 'steps', 'weight', 'vo2max'];

export const EMPTY_TEXT = 'No health data yet. Garmin, the scale, BodySpec and Function Health fill this page after their first sync.';

/**
 * The Garmin line: "Garmin: synced 3 h ago, through Oct 22", last night's sleep, and a warning worth showing.
 * @param {any} status loadGarminStatus
 * @param {{ status: 'in' | 'off' | 'waiting', sleepMin: number | null } | null} lastNight board.lastNight
 * @param {number} now ms
 */
export function statusSection(status, lastNight, now) {
  const night = !lastNight || !status.connected ? null : lastNight.status === 'in' ? `last night ${hm(lastNight.sleepMin ?? 0)} asleep` : NIGHT[lastNight.status];
  return {
    connected: Boolean(status.connected),
    text: garminLine(status, now),
    nightText: night,
    nightIn: lastNight?.status === 'in',
    warning: status.warning && status.warning.level !== 'info' ? { level: status.warning.level, text: status.warning.text } : null,
  };
}

/**
 * One trend per metric for the window: the days with a value, the normal band (mean ± 1 SD of the 60 days before
 * the latest value), the latest value, and the 30/90-day averages.
 * @param {any} b boardOf
 */
export function trendItems(b) {
  const synced = b.days.filter((d) => b.coverage[d] !== 'pending').length;
  return TREND_KEYS.map((key) => {
    const c = BOARD_CHARTS.find((x) => x.key === key);
    const values = b.series[key] ?? [];
    const points = [];
    for (let i = 0; i < b.days.length; i++) {
      const v = values[i];
      if (v !== null && v !== undefined && Number.isFinite(v)) points.push({ date: b.days[i], value: key === 'weight' ? r2(v) : r1(v) });
    }
    const stat = c.stat ? b.stats[c.stat] : null;
    const normal = stat?.normal ?? null;
    const latest = points.at(-1) ?? null;
    const t = c.trend ? b.trend[c.trend] : null;
    const trendLine =
      key === 'weight'
        ? b.series.weightTrend.flatMap((v, i) => (v === null ? [] : [{ date: b.days[i], value: r2(v) }]))
        : undefined;
    return {
      key,
      label: c.label,
      unit: c.unit,
      latestText: latest ? c.fmt(latest.value) : null,
      latestDate: latest?.date ?? null,
      normalText: normal ? `normal ${c.fmt(normal.low)}–${c.fmt(normal.high)}${c.unit && c.unit !== 'peak' && c.unit !== 'avg' ? ` ${c.unit}` : ''}` : null,
      compareText: t && t.avg30 !== null && t.avg90 !== null ? `30d ${c.fmt(t.avg30)} · 90d ${c.fmt(t.avg90)}` : null,
      recordedText: `${points.length}/${synced} ${c.noun ?? 'days'}`,
      points,
      ...(trendLine ? { trendLine } : {}),
      band: normal ? { low: r1(normal.low), high: r1(normal.high) } : null,
      goal: c.goal ? { value: r1(c.goal.value), label: c.goal.label } : null,
      isOff: Boolean(stat && latest && stat.latest?.date === latest.date && isOff(c.bad, stat.status)),
    };
  });
}

/** @param {any} dexa dexaView */
function dexaSummary(dexa) {
  if (!dexa.latest) return null;
  const pick = (key) => dexa.measures.find((m) => m.key === key);
  return {
    scanDate: dexa.latest.scanDate,
    dateText: fmtDate(dexa.latest.scanDate),
    location: dexa.latest.location ?? null,
    scanCount: dexa.scans.length,
    measures: ['bodyFatPct', 'leanMassKg', 'vatMassKg', 'fatMassKg']
      .map(pick)
      .filter((m) => m && m.value !== null)
      .map((m) => {
        const ch = dexaChange(m, m.sincePrevious, 'since last');
        return {
          key: m.key,
          label: m.label,
          value: r2(m.value),
          valueText: m.value.toFixed(m.digits),
          unit: m.unit,
          changeText: ch?.text ?? null,
          tone: ch?.tone ?? null,
        };
      }),
  };
}

/**
 * The whole response. Loaded inputs are `{ ok, value }` (load() in src/lib/safe.ts); `garmin` is a plain value or null
 * (safe() on the web too).
 * @param {{ now: number, days: number, today: string, garmin: any | null, readiness: { ok: boolean, value?: any },
 *   board: { ok: boolean, value?: any }, dexa: { ok: boolean, value?: any }, labs: { ok: boolean, value?: any } }} input
 */
export function healthResponse({ now, days, today, garmin, readiness, board, dexa, labs }) {
  const b = board.ok ? board.value : null;
  const hasSamples = (readiness.ok && readiness.value.lastSampleDate !== null) || (b !== null && b.counts.worn + b.counts.partial > 0);
  const cells = b ? vitalCells(b) : [];
  const w = b?.stats.weight;
  const hasDexa = dexa.ok && dexa.value.latest !== null;
  const hasLabs = labs.ok && labs.value.categories.some((c) => c.biomarkers.length > 0);
  const hasWeight = Boolean(w?.latest);
  return {
    generatedAt: new Date(now).toISOString(),
    today,
    days,
    status: garmin ? { ok: true, ...statusSection(garmin, b?.lastNight ?? null, now) } : { ok: false },
    readiness: readiness.ok ? { ok: true, ...verdictOf(readiness.value.status), flags: readiness.value.flags } : { ok: false },
    vitals: b
      ? {
          ok: true,
          summaryText: hasSamples ? outliersText(cells) : null,
          items: hasSamples
            ? cells.map((c) => ({
                key: c.key,
                label: c.label,
                valueText: c.hasValue ? c.valueText : null,
                unit: c.unit,
                footText: c.footText,
                staleText: c.staleText,
                status: c.status === 'normal' ? 'inRange' : c.status,
                isOff: c.isOff,
                range: roundRange(c.range),
              }))
            : [],
        }
      : { ok: false },
    trends: b ? { ok: true, items: hasSamples ? trendItems(b) : [] } : { ok: false },
    body:
      b && dexa.ok
        ? {
            ok: true,
            weight:
              w && w.latest
                ? {
                    kg: r2(w.latest.value),
                    valueText: w.latest.value.toFixed(1),
                    unit: 'kg',
                    date: w.latest.date,
                    dateText: fmtDay(w.latest.date),
                    trendText: weightFoot(w) ?? null,
                    change4w: w.change28 === null ? null : r2(w.change28),
                    change4wText:
                      w.change28 === null ? null : `${Math.abs(w.change28) < 0.05 ? '±' : w.change28 < 0 ? '▼' : '▲'} ${Math.abs(w.change28).toFixed(1)} kg in 4 weeks`,
                  }
                : null,
            dexa: dexaSummary(dexa.value),
          }
        : { ok: false },
    labs: labs.ok ? { ok: true, ...labsSummary(labs.value.categories, labs.value.draws) } : { ok: false },
    emptyText: !hasSamples && !hasWeight && !hasDexa && !hasLabs && board.ok && dexa.ok && labs.ok ? EMPTY_TEXT : null,
  };
}
