// GET /api/app/trends (lift/APP-API.md): the web's Trends page (src/app/(dashboard)/trends/page.tsx) as
// display-ready JSON for the Lift iPhone app. The text comes from display.mjs, the same functions the web page
// uses. Pure: the loader (app-pages.ts) reads the data with the web's loaders. node --test (trends-api.test.mjs).

import {
  MUSCLE_TARGET, RAMP_NOTE, hoursSeries, hoursText, muscleLabel, muscleRows, muscleStatusText, peakText,
  decimalText, performanceTiles, rampCell, shortDate, shortDateYear, sportDetail, staleText, weekRow,
} from './display.mjs';
import { RUN_DISTANCES } from './peaks.mjs';
import { mainLift, section } from './today-api.mjs';
import { mondayOf } from '../plan/week.mjs';

const r2 = (v) => Math.round(v * 100) / 100;
const METERS = new Map(RUN_DISTANCES.map((d) => [d.span, d.meters]));

/** The tiles, the weekly hours chart and the table "every week". */
export function performanceSection(perf, today, strengthTarget, sports) {
  const currentWeek = mondayOf(today);
  const { series, total, average } = hoursSeries(perf.weeks, currentWeek, sports);
  return {
    staleText: staleText(perf.latestActivity, today),
    tiles: performanceTiles(perf, currentWeek, strengthTarget).map((t) => ({
      key: t.key,
      label: t.label,
      valueText: t.valueText,
      sport: t.sport,
      delta: t.delta ? { pct: t.delta.pct, text: t.delta.text, tone: t.delta.up ? 'up' : 'down' } : null,
      // With a delta, the web shows "▲ 12% vs the 4 weeks before"; without, the foot alone.
      footText: t.delta ? 'vs the 4 weeks before' : t.foot,
      spark: { values: t.spark.values.map(r2), labels: t.spark.labels, texts: t.spark.texts },
    })),
    weeklyHours: {
      sports: series.map((s) => ({ id: s.id, label: s.label })),
      average: r2(average),
      averageText: average > 0 ? `avg ${hoursText(average)}` : null,
      weeks: perf.weeks.map((w) => ({
        week: w.week,
        label: shortDate(w.week),
        current: w.week === currentWeek,
        hours: r2(total(w)),
        hoursText: hoursText(total(w)),
        sports: series
          .filter((s) => (w.sports[s.id]?.hours ?? 0) > 0)
          .map((s) => ({ id: s.id, hours: r2(w.sports[s.id].hours), hoursText: hoursText(w.sports[s.id].hours), detail: sportDetail(s, w.sports[s.id]) })),
        strength: w.strength,
        tss: Math.round(w.tss),
      })),
    },
    table: [...perf.weeks].reverse().map((w) => weekRow(w, currentWeek)),
  };
}

/** One peak table (power or run): every span, a cell per window; `best` where it equals the all-time best. */
function peakTable(metric, rows, windows) {
  return {
    empty: rows.every((r) => !r.cells.all),
    rows: rows.map((r) => ({
      span: r.span,
      label: r.label,
      cells: Object.fromEntries(
        windows.map((w) => {
          const c = r.cells[w.key];
          if (!c) return [w.key, null];
          const { main, sub } = peakText(metric, METERS.get(r.span) ?? r.span, c.value);
          return [w.key, {
            value: Math.round(c.value),
            text: main,
            subText: sub,
            date: c.date,
            dateText: shortDateYear(c.date),
            activityId: String(c.activityId),
            name: c.name ?? null,
            best: c.activityId === r.cells.all?.activityId,
          }];
        })
      ),
    })),
  };
}

export function peaksSection(peaks) {
  return {
    note: `From Strava streams. Elapsed time for runs, so stops count.${peaks.pending > 0 ? ` ${peaks.pending} activities still to scan.` : ''}`,
    windows: peaks.windows.map((w) => ({ key: w.key, label: w.label })),
    power: { title: 'Power', unitText: 'best average, W', ...peakTable('power', peaks.power, peaks.windows) },
    run: { title: 'Run', unitText: 'fastest time · pace /km', ...peakTable('run', peaks.run, peaks.windows) },
  };
}

export function liftSection(l) {
  if (!l.hasData) return { hasData: false, emptyText: 'No Lift sessions on the server yet. Connect Lift on the iPhone.', muscles: null, mainLifts: [] };
  return {
    hasData: true,
    emptyText: null,
    muscles: {
      band: { ...MUSCLE_TARGET },
      note: 'This week. A set counts 1 for a primary muscle and 0.5 for a secondary one.',
      rows: muscleRows(l.thisWeek, l.last4).map((m) => ({
        muscle: m.muscle,
        label: muscleLabel(m.muscle),
        week: m.week,
        weekText: decimalText(m.week),
        avg: r2(m.avg),
        avgText: decimalText(m.avg),
        status: m.week < MUSCLE_TARGET.min ? 'below' : m.week > MUSCLE_TARGET.max ? 'above' : 'inRange',
        statusText: muscleStatusText(m.week),
      })),
    },
    mainLifts: l.top.map((x) => mainLift(x, l.unit)),
    unit: l.unit,
  };
}

/**
 * The whole response. Loaded inputs are `{ ok, value }` (load() in src/lib/safe.ts).
 * @param {{ now: Date, timeZone: string, today: string, perf: any, pmc: any, peaks: any, lift: any, strengthTarget: number, sports: { id: string, label: string }[] }} input
 */
export function trendsResponse({ now, timeZone, today, perf, pmc, peaks, lift, strengthTarget, sports }) {
  return {
    generatedAt: now.toISOString(),
    timeZone,
    today,
    performance: section(perf, (p) => performanceSection(p, today, strengthTarget, sports)),
    ramp: section(pmc, (p) => ({ rates: p.ramp.map(rampCell), note: RAMP_NOTE })),
    peaks: section(peaks, peaksSection),
    lift: section(lift, liftSection),
  };
}
