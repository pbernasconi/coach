// GET /api/app/today (lift/APP-API.md): the web's Today page (src/app/(dashboard)/page.tsx) as display-ready JSON
// for the Lift iPhone app. The text comes from display.mjs, the same functions the web page uses. Pure: the loader
// (app-pages.ts) reads the data with the web's loaders. node --test (today-api.test.mjs).

import { FORM_ZONES, zoneOf } from './form.mjs';
import {
  MUSCLE_TARGET, daysAgoText, e1rmText, goalView, headerChips, last4Tiles, lastWeeks, liftChangeText, longDate,
  projectionCaption, setsText, shortDate, staleText, todayItemText, todayWorkouts, weightChange,
} from './display.mjs';
import { plainTitle } from '../plan/calendar.mjs';
import { sportId } from '../plan/week-api.mjs';
import { mondayOf } from '../plan/week.mjs';

const r1 = (v) => Math.round(v * 10) / 10;
const ARMS = ['biceps', 'triceps'];

/** A section: `{ ok: true, ...data }` from a loaded value, or `{ ok: false }`. */
export const section = (loaded, shape) => (loaded?.ok ? { ok: true, ...shape(loaded.value) } : { ok: false });

/**
 * A main lift row (Today's "Main lifts · e1RM" and Trends' "Main lifts"): name, e1RM per session for a sparkline,
 * the latest e1RM, and its change in 12 weeks. `tone`: up good, down bad, null unknown.
 * @param {{ key: string, name: string, points: { day: string, e1rm: number }[], latest: number | null, change: number | null }} l  topLifts
 */
export function mainLift(l, unit) {
  return {
    exerciseKey: l.key,
    name: l.name,
    points: l.points.map((p) => ({ day: p.day, e1rm: r1(p.e1rm) })),
    latest: l.latest == null ? null : r1(l.latest),
    latestText: e1rmText(l.latest, unit),
    change: l.change == null ? null : Math.round(l.change * 1000) / 1000,
    changeText: liftChangeText(l.change),
    tone: l.change == null ? null : l.change >= 0 ? 'good' : 'bad',
    sparkText: l.points.length < 2 ? '1 session' : null,
  };
}

/** The fitness chart: CTL/ATL/TSB per day (projected after today), form zones, events, and the caption. */
export function fitnessSection(pmc) {
  const last = pmc.days.filter((d) => !d.projected).at(-1) ?? null;
  return {
    today: pmc.today,
    days: pmc.days.map((d) => ({ date: d.date, ctl: r1(d.ctl), atl: r1(d.atl), tsb: r1(d.tsb), tss: Math.round(d.tss), projected: d.projected })),
    zones: FORM_ZONES.map((z) => ({ label: z.label, from: Number.isFinite(z.from) ? z.from : null, to: Number.isFinite(z.to) ? z.to : null, shade: z.shade })),
    events: pmc.events.map((e) => ({ id: String(e.id), name: e.name, date: e.date, priority: e.priority })),
    now: last ? { date: last.date, ctl: r1(last.ctl), atl: r1(last.atl), tsb: r1(last.tsb), zone: zoneOf(last.tsb) } : null,
    caption: projectionCaption(pmc),
  };
}

/**
 * The whole response. Loaded inputs are `{ ok, value }` (load() in src/lib/safe.ts); `recovery` and `targets` are
 * optional on the web too (safe() with a fallback), so they are plain values here.
 * @param {{
 *   now: Date, timeZone: string, today: string,
 *   perf: { ok: boolean, value?: any }, week: { ok: boolean, value?: any }, pmc: { ok: boolean, value?: any },
 *   lift: { ok: boolean, value?: any }, body: { ok: boolean, value?: any }, goals: { ok: boolean, value?: any },
 *   recovery: any | null, strengthTarget: number,
 *   sports: { known: Set<string>, label: (id: string) => string },
 * }} input
 */
export function todayResponse({ now, timeZone, today, perf, week, pmc, lift, body, goals, recovery, strengthTarget, sports }) {
  const monday = mondayOf(today);
  const r = recovery?.hasData ? recovery : null;
  const load = pmc.ok ? pmc.value.days.filter((d) => !d.projected).at(-1) ?? null : null;
  const chips = headerChips(r, load);
  const weeks = perf.ok ? perf.value.weeks : [];
  const thisWeek = weeks.find((w) => w.week === monday);
  return {
    generatedAt: now.toISOString(),
    timeZone,
    today,
    dateText: longDate(today),
    header: { ok: true, chips, emptyText: !r && !load ? 'No Garmin data today.' : null },
    stale: { ok: perf.ok, text: perf.ok ? staleText(perf.value.latestActivity, today) : null },
    todayLine: section(week, (range) => {
      const { items, emptyText } = todayWorkouts(range);
      return {
        items: items.map((w) => ({
          id: String(w.id),
          title: plainTitle(w.title),
          sport: sportId(w, sports.known),
          state: w.state,
          text: todayItemText(w),
          liftSessionId: w.liftSessionId ? String(w.liftSessionId).toLowerCase() : null,
        })),
        emptyText,
        cue: null, // Lift still reads this key; the readiness advice is gone (2026-10-22).
      };
    }),
    fitness: section(pmc, fitnessSection),
    last4Weeks: section(perf, (p) => {
      const { last4 } = lastWeeks(p.weeks, monday);
      return { tiles: last4.length ? last4Tiles(last4, strengthTarget) : [] };
    }),
    body: section(body, (b) => {
      const change = weightChange(b.change4w);
      return {
        weight: b.weight
          ? {
              date: b.weight.date,
              kg: r1(b.weight.value),
              text: b.weight.value.toFixed(1),
              unit: 'kg',
              change4w: b.change4w == null ? null : r1(b.change4w),
              changeText: change?.text ?? null,
              changeTone: change?.tone ?? null,
              noteText: change ? `in 4 weeks · ${change.perWeekText}` : `as of ${shortDate(b.weight.date)}`,
            }
          : null,
        series: b.series.map((p) => ({ date: p.date, kg: r1(p.value) })),
        bodyFatText: b.bodyFat ? `${b.bodyFat.value.toFixed(1)} %` : '–',
        bodyFat: b.bodyFat ? r1(b.bodyFat.value) : null,
        emptyText: b.weight ? null : 'No weight in the last 12 weeks. Step on the scale and it arrives with the next vitals push.',
      };
    }),
    lift: section(lift, (l) => {
      const sets = (m) => l.thisWeek.find((row) => row.muscle.toLowerCase() === m)?.sets ?? 0;
      const done = thisWeek?.strength ?? 0;
      return {
        unit: l.unit,
        hasData: l.hasData,
        arms: {
          band: { ...MUSCLE_TARGET },
          bandText: `target ${MUSCLE_TARGET.min}–${MUSCLE_TARGET.max}`,
          rows: ARMS.map((m) => ({ muscle: m, sets: sets(m), setsText: setsText(sets(m)) })),
        },
        mainLifts: l.hasData ? l.top.map((x) => mainLift(x, l.unit)) : [],
        mainLiftsEmptyText: l.hasData && l.top.length > 0 ? null : 'No Lift sessions in 12 weeks.',
        strength: { done, target: strengthTarget, text: `${done} / ${strengthTarget} this week` },
        last: l.last
          ? {
              sessionId: String(l.last.id).toLowerCase(),
              day: l.last.day,
              daysSince: l.daysSince,
              whenText: daysAgoText(l.daysSince),
              late: l.daysSince != null && l.daysSince >= 10,
              title: l.last.title || 'Session',
              prs: l.prs,
              text: `${l.last.title || 'Session'}${l.prs ? ` · ${l.prs} PR${l.prs > 1 ? 's' : ''}` : ''}`,
            }
          : null,
        next: l.next
          ? { sessionId: String(l.next.id).toLowerCase(), day: l.next.day, dateText: shortDate(l.next.day), title: l.next.title || 'Session' }
          : null,
        nextEmptyText: l.next ? null : 'Not planned yet',
      };
    }),
    goals: section(goals, (gs) => ({ items: gs.map(goalView), emptyText: gs.length ? null : 'No goals. Add milestones in Settings.' })),
  };
}

