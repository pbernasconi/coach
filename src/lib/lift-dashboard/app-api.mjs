// @ts-check
// GET /api/app/lift… (lift/APP-API.md, "Lift"): the web's /lift pages as display-ready JSON for the Lift app. Pure:
// it shapes what the pages already compute (liftOverview, weeklyVolume, sessionDetail + media, exerciseDetail)
// with the same text helpers (./text.mjs), so the phone shows the web's numbers and words. The loaders are in
// app-api.ts. node --test (app-api.test.mjs).

import {
  MUSCLE_BAND, SESSION_STATE_LABEL, bandStatus, changeText, compact, clockText, deltaText, exerciseChips, exerciseIndexText, fmtDay, fmtSets,
  formatDay, formatVolume, formatWeight, heatLevel, isNewBest, lastTimeDelta, liftBestText, liftLastText, loadModeNote,
  loadText, muscleGroups, muscleLabel, muscleName, nextWhen, num, plannedText, recordGain, recordText, restText, rpeText,
  sessionMeta, sessionStats, setTile, weekStats,
} from './text.mjs';
import { plannedVolume, sessionMuscles, sessionState } from '../lift/session-stats.mjs';
import { exerciseResult, summaryGrid, watchSection } from './session-result.mjs';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** Logged sessions the web shows before "Show older sessions". */
export const SESSIONS_SHOWN = 8;
/** At most this many points in an e1RM chart; longer histories are downsampled. */
export const MAX_CHART_POINTS = 120;

/** @param {number} n */
const r1 = (n) => Math.round(n * 10) / 10;
/** A ratio to 3 decimals (0.249). @param {number} n */
const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Runs one section's shaping: `{ ok: true, …data }`, or `{ ok: false }` (logged) so one failure never blanks the screen.
 * @template {object} T
 * @param {string} label
 * @param {() => T} build
 * @returns {({ ok: true } & T) | { ok: false }}
 */
export function section(label, build) {
  try {
    return { ok: true, ...build() };
  } catch (error) {
    console.error(`[app-api] lift ${label} failed:`, error);
    return { ok: false };
  }
}

/**
 * Keeps at most `max` items: the first, the last, and evenly spaced ones between.
 * @template T
 * @param {T[]} list
 * @param {number} max
 */
export function downsample(list, max) {
  if (list.length <= max) return list;
  const step = (list.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => list[Math.round(i * step)]);
}

/**
 * A web link of the /lift pages as an app link: a session, an exercise, the week plan, or a section of the Lift
 * screen. Web-only pages (Health, Settings) give null.
 * @param {string | undefined} href
 * @returns {{ kind: 'session', sessionId: string } | { kind: 'exercise', exerciseKey: string } | { kind: 'week' } | { kind: 'section', section: string } | null}
 */
export function appLink(href) {
  if (!href) return null;
  let m = /^\/lift\/sessions\/([^/?#]+)$/.exec(href);
  if (m) return { kind: 'session', sessionId: decodeURIComponent(m[1]).toLowerCase() };
  m = /^\/lift\/exercises\/([^/?#]+)$/.exec(href);
  if (m) return { kind: 'exercise', exerciseKey: decodeURIComponent(m[1]) };
  if (href === '/plan') return { kind: 'week' };
  m = /^#(muscles|records|consistency|sessions)$/.exec(href);
  if (m) return { kind: 'section', section: m[1] };
  return null;
}

// ---- GET /api/app/lift ----

/**
 * @typedef {ReturnType<typeof import('./overview.mjs').liftOverview>} Overview
 * @typedef {ReturnType<typeof import('./stats.mjs').exerciseList>} ExerciseList
 */

/** @param {Overview} o */
function weekSection(o) {
  const week = o.calendar.at(-1) ?? [];
  const done = o.thisWeek.sessions;
  const progress = Math.min(1, done / Math.max(1, o.strengthTarget));
  const planned = new Map(o.upcoming.map((u) => [u.day, u]));
  const next = o.upcoming[0] ?? null;
  return {
    title: `This week · ${fmtDay(o.monday)}–${fmtDay(week.at(-1)?.day ?? o.monday)}`,
    done,
    target: o.strengthTarget,
    doneText: `${done} / ${o.strengthTarget}`,
    caption: 'strength sessions',
    progress,
    targetMet: progress >= 1,
    days: week.map((d, i) => {
      const p = planned.get(d.day);
      const long = fmtDay(d.day, { weekday: 'long' });
      return {
        date: d.day,
        letter: LETTERS[i],
        state: d.sets ? 'done' : p ? 'planned' : 'none',
        today: d.day === o.today,
        sessionId: d.sessionId ?? p?.id ?? null,
        label: d.sets ? `${long}: ${d.title}, ${d.sets} sets` : p ? `${long}: ${p.title} planned` : long,
      };
    }),
    stats: weekStats(o).map((s) => ({ ...s, flame: s.id === 'streak' && o.streak > 1 })),
    next: next
      ? { sessionId: next.id, date: next.day, title: next.title || 'Lift session', whenText: `Next up · ${nextWhen(next.day, o.today)}`, detail: plannedText(next) }
      : null,
    nextEmptyText: 'No Lift session planned. Put one on the plan, or start one from a template in the app.',
  };
}

/** @param {Overview} o */
function tipsSection(o) {
  return {
    title: 'Coach notes',
    items: o.tips.map((t) => ({ id: t.id, tone: t.tone, title: t.title, body: t.body, link: appLink(t.href) })),
  };
}

/** @param {Overview} o */
function liftsSection(o) {
  return {
    caption: 'estimated 1RM per session · dashed line is your best',
    emptyText: 'No lifts in the last 12 weeks.',
    items: o.lifts.map((l) => ({
      exerciseKey: l.key,
      name: l.name,
      sessions: l.sessions,
      sessionsText: `${l.sessions} sessions`,
      newBest: isNewBest(l, o.today),
      e1rm: l.latest ? r1(l.latest.e1rm) : null,
      e1rmText: l.latest ? String(Math.round(l.latest.e1rm)) : '–',
      change: l.change === null ? null : r3(l.change),
      changeText: changeText(l.change),
      best: l.best ? r1(l.best.e1rm) : null,
      points: l.points.map((p) => ({
        date: p.day,
        sessionId: p.sessionId,
        e1rm: r1(p.e1rm),
        label: `${fmtDay(p.day)}: ${Math.round(p.weight)} × ${p.reps}, e1RM ${Math.round(p.e1rm)}`,
      })),
      chartEmptyText: l.points.length < 2 ? 'One session so far. The trend starts with the next one.' : null,
      lastText: liftLastText(l.latest, o.unit),
      bestText: liftBestText(l.best),
    })),
  };
}

/** @param {{ muscle: string, week: number, avg: number, arm: boolean }} r */
function muscleRow(r) {
  const status = bandStatus(r.avg);
  /** The words of the Trends section (muscleSets): below, inRange, above. */
  const band = status === 'in' ? 'inRange' : status;
  return {
    muscle: r.muscle,
    name: muscleName(r.muscle),
    arm: r.arm,
    week: r.week,
    weekText: fmtSets(r.week),
    avg: r1(r.avg),
    avgText: fmtSets(r.avg),
    status: band,
    label: `${muscleName(r.muscle)}: ${fmtSets(r.week)} sets this week, ${fmtSets(r.avg)} a week on average, ${status} the 10 to 20 range`,
  };
}

/** @param {Overview} o */
function musclesSection(o) {
  const { arms, rest } = muscleGroups(o.muscles);
  return {
    title: 'Hard sets per muscle',
    caption: '10–20 a week grows a muscle. Primary muscle 1 set, secondary ½.',
    band: MUSCLE_BAND,
    scaleMax: Math.max(24, ...o.muscles.map((r) => Math.max(r.week, r.avg))),
    arms: arms.map(muscleRow),
    other: rest.map(muscleRow),
  };
}

/** @param {Overview} o */
function sessionsSection(o) {
  const max = Math.max(1, ...o.sessions.map((s) => s.volume));
  return {
    caption: `${o.sessions.length} logged · volume = reps × weight, warm-ups out`,
    shown: SESSIONS_SHOWN,
    upcoming: o.upcoming.map((u) => ({
      sessionId: u.id,
      date: u.day,
      title: u.title || 'Lift session',
      badge: u.day === o.today ? 'Today' : 'Planned',
      detail: `${fmtDay(u.day, { weekday: 'short', month: 'short', day: 'numeric' })} · ${u.sets} sets`,
    })),
    logged: o.sessions.map((s) => ({
      sessionId: s.id,
      date: s.day,
      weekdayText: fmtDay(s.day, { weekday: 'short' }),
      dayText: fmtDay(s.day, { day: 'numeric' }),
      monthText: fmtDay(s.day, { month: 'short' }),
      title: s.title || 'Lift session',
      meta: sessionMeta(s),
      sets: s.sets,
      exercises: s.exercises,
      minutes: s.minutes,
      volume: Math.round(s.volume),
      volumeText: s.volume > 0 ? compact(s.volume) : '–',
      volumeUnit: s.volume > 0 ? o.unit : 'no weights',
      relative: r3(s.volume / max),
      muscles: s.muscles.map(muscleName),
      prs: s.prs,
      prText: s.prs.length ? `${s.prs.length} ${s.prs.length === 1 ? 'PR' : 'PRs'}` : null,
    })),
  };
}

/** @param {ExerciseList} exercises @param {string} unit */
function exercisesSection(exercises, unit) {
  return {
    title: 'All exercises',
    count: exercises.length,
    items: exercises.map((e) => ({
      exerciseKey: e.key,
      name: e.name,
      sessions: e.sessions,
      detail: exerciseIndexText(e),
      bestText: e.bestE1rm ? `${Math.round(e.bestE1rm)} ${unit}` : '–',
    })),
  };
}

/** @param {Overview} o */
function consistencySection(o) {
  return {
    caption: '16 weeks',
    stats: [
      { id: 'hits', value: `${o.hits}/8`, label: 'weeks at target' },
      { id: 'avg', value: o.avg8.toFixed(1), label: 'a week, 8 wks' },
      { id: 'total', value: String(o.totals.sessions), label: 'sessions logged' },
    ],
    hits: o.hits,
    avg: r1(o.avg8),
    total: o.totals.sessions,
    // Columns are weeks (oldest first), rows Monday to Sunday. level: 0 none … 4 for 20+ sets.
    heatmap: o.calendar.map((w, i) => ({
      start: w[0].day,
      monthText: i === 0 || w[0].day.slice(5, 7) !== o.calendar[i - 1][0].day.slice(5, 7) ? fmtDay(w[0].day, { month: 'short' }) : null,
      days: w.map((d) => {
        const when = fmtDay(d.day, { weekday: 'short', month: 'short', day: 'numeric' });
        return {
          date: d.day,
          sets: d.sets,
          level: heatLevel(d.sets),
          future: d.future,
          today: d.day === o.today,
          sessionId: d.sessionId,
          label: d.sets ? `${when}: ${d.title}, ${d.sets} sets` : when,
        };
      }),
    })),
    weeks: {
      target: o.strengthTarget,
      scaleMax: Math.max(o.strengthTarget + 1, ...o.weeks.map((w) => w.sessions)),
      caption: `line = target ${o.strengthTarget}`,
      items: o.weeks.map((w) => ({
        week: w.week,
        sessions: w.sessions,
        sets: w.sets,
        met: w.sessions >= o.strengthTarget,
        label: `Week of ${fmtDay(w.week)}: ${w.sessions} sessions, ${w.sets} sets`,
      })),
    },
  };
}

/** @param {Overview} o */
function recordsSection(o) {
  return {
    title: 'Recent records',
    caption: 'estimated 1RM',
    emptyText: 'No records yet. They appear when a set beats every earlier session.',
    items: o.prs.map((r) => ({
      exerciseKey: r.key,
      sessionId: r.sessionId,
      name: r.name,
      date: r.day,
      detail: recordText(r, o.unit),
      e1rm: r1(r.e1rm),
      e1rmText: String(Math.round(r.e1rm)),
      gainText: recordGain(r, o.unit),
    })),
  };
}

/** @param {Overview} o */
function summarySection(o) {
  const done = o.thisWeek.sessions;
  const next = o.upcoming[0] ?? null;
  return {
    text: `${done} of ${o.strengthTarget} ${o.strengthTarget === 1 ? 'session' : 'sessions'} this week`,
    done,
    target: o.strengthTarget,
    progress: Math.min(1, done / Math.max(1, o.strengthTarget)),
    next: next
      ? { sessionId: next.id, date: next.day, title: next.title || 'Lift session', whenText: nextWhen(next.day, o.today), detail: plannedText(next) }
      : null,
    nextEmptyText: 'No Lift session planned.',
  };
}

/** @param {Overview} o */
function focusSection(o) {
  return {
    source: o.focus.source,
    muscles: o.focus.muscles.map((m) => ({ muscle: m, name: muscleName(m) })),
    lifts: o.focus.lifts.map((l) => ({ exerciseKey: l.key, name: l.name })),
  };
}

/** @param {Overview} o */
function targetingSection(o) {
  const items = o.focus.targeting.map((t) => {
    const name = muscleName(t.muscle);
    return {
      muscle: t.muscle,
      name,
      done: t.done,
      planned: t.planned,
      status: t.status,
      text: t.planned ? `${fmtSets(t.done)} done · ${fmtSets(t.planned)} planned` : `${fmtSets(t.done)} done`,
      label: `${name}: ${fmtSets(t.done)} sets done and ${fmtSets(t.planned)} planned this week, aim ${MUSCLE_BAND.min} to ${MUSCLE_BAND.max}`,
      sessions: t.sessions.map((s) => ({
        sessionId: s.id,
        dayText: fmtDay(s.day, { weekday: 'short' }),
        title: s.title || 'Lift session',
        sets: s.sets,
        setsText: `${fmtSets(s.sets)} ${s.sets === 1 ? 'set' : 'sets'}`,
        done: s.done,
      })),
    };
  });
  return {
    caption: `Hard sets this week · aim ${MUSCLE_BAND.min}–${MUSCLE_BAND.max}`,
    band: MUSCLE_BAND,
    scaleMax: Math.max(24, ...items.map((i) => i.done + i.planned)),
    items,
    emptyText: 'Log a session to see which muscles this week works.',
  };
}

/** @param {Overview} o */
function progressSection(o) {
  return {
    caption: 'Estimated 1RM · last 8 weeks',
    items: o.focus.progress.map((p) => ({
      exerciseKey: p.key,
      name: p.name,
      e1rm: p.e1rm === null ? null : r1(p.e1rm),
      e1rmText: p.e1rm === null ? '–' : `${Math.round(p.e1rm)} ${o.unit}`,
      change: p.change === null ? null : r3(p.change),
      changeText:
        p.change === null
          ? null
          : Math.round(p.change * 100) === 0
            ? `Same as ${fmtDay(p.since ?? o.today)}`
            : `${p.change > 0 ? '+' : '−'}${Math.abs(Math.round(p.change * 100))}% since ${fmtDay(p.since ?? o.today)}`,
      tone: p.change === null || Math.abs(p.change) < 0.005 ? 'same' : p.change > 0 ? 'up' : 'down',
      points: p.points.map((pt) => ({ date: pt.day, e1rm: r1(pt.e1rm) })),
      prText: p.prDay ? `PR ${fmtDay(p.prDay)}` : null,
      emptyText: p.points.length < 2 ? (p.points.length ? 'One session so far' : 'Not done in 8 weeks') : null,
    })),
    emptyText: 'No lifts with a weight yet.',
  };
}

/** The one coach note worth a line, or none. @param {Overview} o */
function noteSection(o) {
  const t = o.tips.find((tip) => tip.tone !== 'info') ?? null;
  return { item: t ? { id: t.id, tone: t.tone, title: t.title, body: t.body, link: appLink(t.href) } : null };
}

/**
 * The whole GET /api/app/lift response from what the /lift page computes. `overview`/`exercises` null: the model
 * failed to load, so every section is `{ ok: false }`.
 * @param {{ overview: Overview | null, exercises: ExerciseList | null, timeZone: string, today: string, now: Date }} input
 */
export function liftResponse({ overview: o, exercises, timeZone, today, now }) {
  /** @template {object} T @param {string} label @param {(o: Overview) => T} build */
  const part = (label, build) => (o ? section(label, () => build(o)) : /** @type {{ ok: false }} */ ({ ok: false }));
  return {
    generatedAt: now.toISOString(),
    timeZone,
    today,
    unit: o?.unit ?? null,
    empty: o && o.totals.sessions === 0 ? { title: 'No sessions yet', body: 'Sessions appear here after the Lift app syncs.' } : null,
    summary: part('summary', summarySection),
    focus: part('focus', focusSection),
    targeting: part('targeting', targetingSection),
    progress: part('progress', progressSection),
    note: part('note', noteSection),
    week: part('week', weekSection),
    tips: part('tips', tipsSection),
    lifts: part('lifts', liftsSection),
    muscles: part('muscles', musclesSection),
    sessions: part('sessions', sessionsSection),
    exercises: o && exercises ? section('exercises', () => exercisesSection(exercises, o.unit)) : { ok: false },
    consistency: part('consistency', consistencySection),
    records: part('records', recordsSection),
  };
}

// ---- GET /api/app/lift/weekly ----

/**
 * @param {{ weeks: ReturnType<typeof import('./stats.mjs').weeklyVolume> | null, unit: string | null, now: Date }} input
 */
export function weeklyResponse({ weeks, unit, now }) {
  return {
    generatedAt: now.toISOString(),
    unit,
    weeks: weeks && unit
      ? section('weekly', () => {
          const max = Math.max(1, ...weeks.map((w) => w.volume));
          return {
            title: 'Weekly volume',
            caption: `Weeks start on Monday. Volume = reps x logged weight over logged sets, warm-ups excluded, in ${unit}.`,
            emptyText: 'No sessions yet.',
            items: weeks.map((w) => ({
              week: w.week,
              weekText: formatDay(w.week),
              sessions: w.sessions,
              sets: w.sets,
              volume: Math.round(w.volume),
              volumeText: formatVolume(w.volume, unit),
              relative: r3(w.volume / max),
            })),
          };
        })
      : { ok: false },
  };
}

// ---- GET /api/app/lift/sessions/:id ----

/**
 * @typedef {{ image: string | null, gif: string | null, target: string | null, secondary: string[], equipment: string | null, steps: string[] }} Media
 * @typedef {NonNullable<ReturnType<typeof import('./stats.mjs').sessionDetail>>} Detail
 * @typedef {Omit<Detail, 'exercises'> & { exercises: (Detail['exercises'][number] & { media: Media | null })[] }} Rich
 */

/** @param {Rich} d @param {string} timeZone @param {ReturnType<typeof watchSection>} watch */
function heroSection(d, timeZone, watch) {
  const state = sessionState(d);
  const results = d.exercises.map((e) => exerciseResult(e, d.unit));
  const start = clockText(d.startedAt, timeZone);
  const muscles = sessionMuscles(d).slice(0, 8);
  const most = muscles[0]?.sets ?? 1;
  return {
    kicker: `Strength · ${formatDay(d.day)}${start ? ` · ${start}` : ''}`,
    date: d.day,
    dateText: formatDay(d.day),
    startText: start,
    title: d.title || 'Lift session',
    note: d.note,
    state,
    stateLabel: SESSION_STATE_LABEL[state],
    stats: sessionStats(d, plannedVolume(d)),
    summary: summaryGrid(d, results, watch, state),
    watchActivityId: watch?.activityId ?? null,
    ring: {
      logged: d.setsLogged,
      total: d.setsTotal,
      progress: d.setsTotal ? r3(d.setsLogged / d.setsTotal) : 0,
      text: `${d.setsLogged}/${d.setsTotal}`,
      caption: 'sets logged',
    },
    muscles: muscles.map((m) => ({ muscle: m.muscle, name: muscleLabel(m.muscle), sets: m.sets, setsText: num(m.sets), relative: r3(m.sets / most) })),
  };
}

/** @param {Rich['exercises'][number]} e @param {number} index @param {string} unit */
function exerciseCard(e, index, unit) {
  const h = e.history;
  const media = e.media;
  const working = e.sets.filter((s) => s.kind !== 'warmUp');
  const logged = working.filter((s) => s.status === 'done').length;
  const chips = exerciseChips(e);
  // As ExerciseCard: an estimated 1RM from the added load alone means nothing, so bodyweight work shows none.
  const showE1rm = e.loadMode !== 'bodyweight';
  const delta = lastTimeDelta(e);
  const note = loadModeNote(e.loadMode);
  return {
    id: e.id,
    exerciseKey: e.key,
    indexText: `Exercise ${index + 1}`,
    name: e.name,
    setsText: `${logged}/${working.length} sets`,
    complete: working.length > 0 && logged === working.length,
    muscles: chips.primary.map(muscleLabel),
    secondaryMuscles: chips.secondary.map(muscleLabel),
    equipment: chips.equipment,
    loadNote: note ? `Load ${note}` : null,
    restText: restText(e.restSeconds),
    note: e.note,
    sets: e.sets.map((s) => {
      const tile = setTile(s, e.loadMode, unit);
      return {
        id: s.id,
        label: s.kind === 'warmUp' ? 'Warm-up' : `Set ${s.label}`,
        kind: s.kind,
        status: s.status,
        // Done: what was logged, with the target below. Otherwise: the target.
        text: tile.logged ?? tile.target,
        targetText: tile.logged ? `target ${tile.target}` : null,
        beatTarget: tile.beatTarget,
        rpe: s.rpe ?? null,
        rpeText: rpeText(s.rpe),
        note: s.note,
      };
    }),
    lastTime: h.last
      ? {
          sessionId: h.last.sessionId,
          date: h.last.day,
          title: `Last time · ${fmtDay(h.last.day)}`,
          delta: delta == null || delta === 0 ? null : r1(delta),
          deltaText: deltaText(delta, unit),
          sets: h.last.sets.map((s) => `${loadText(s.weight, e.loadMode, unit) || '–'} × ${s.reps ?? '?'}`),
        }
      : null,
    lastTimeEmptyText: h.last ? null : 'First time logged',
    best: showE1rm && h.best ? { e1rm: r1(h.best.e1rm), text: `${num(h.best.e1rm, 0)} ${unit}`, date: h.best.day, dateText: fmtDay(h.best.day) } : null,
    trend: showE1rm && h.trend.length >= 2 ? { values: h.trend.map((p) => r1(p.e1rm)), caption: `e1RM · last ${h.trend.length} sessions` } : null,
    steps: media?.steps ?? [],
    media: media && (media.image || media.gif) ? { image: media.image, gif: media.gif } : null,
    result: exerciseResult(e, unit),
  };
}

/**
 * The whole GET /api/app/lift/sessions/:id response from a session with media (lib/lift/session.ts richSession).
 * `watch`: the activity page's body of the Strava activity the watch recorded for this lift (null: none; false: it did
 * not load). `feedback`: the "How did it feel" block (feedbackBlock), null when it did not load.
 * @param {{ session: Rich, timeZone: string, now: Date, watch?: object | null | false, feedback?: object | null }} input
 */
export function sessionResponse({ session: d, timeZone, now, watch = null, feedback = null }) {
  const watchCard = watch ? watchSection(watch) : null;
  return {
    generatedAt: now.toISOString(),
    timeZone,
    id: d.id,
    unit: d.unit,
    olderId: d.olderId,
    newerId: d.newerId,
    hero: section('session hero', () => heroSection(d, timeZone, watchCard)),
    watch: watch === false ? { ok: false } : watchCard ? { ok: true, ...watchCard } : null,
    feedback,
    exercises: section('session exercises', () => ({
      emptyText: 'This session has no exercises.',
      items: d.exercises.map((e, i) => exerciseCard(e, i, d.unit)),
    })),
  };
}

// ---- GET /api/app/lift/exercises/:key ----

/** "100 kg x 5", as the exercise page. @param {number | null} w @param {number | null} reps @param {string} unit */
export const bestSetText = (w, reps, unit) => `${formatWeight(w, unit)} x ${reps ?? '-'}`;

/**
 * The whole GET /api/app/lift/exercises/:key response from exerciseDetail.
 * @param {{ detail: NonNullable<ReturnType<typeof import('./stats.mjs').exerciseDetail>>, unit: string, now: Date }} input
 */
export function exerciseResponse({ detail, unit, now }) {
  return {
    generatedAt: now.toISOString(),
    unit,
    exerciseKey: detail.key,
    name: detail.name,
    stats: section('exercise stats', () => ({
      items: [
        { id: 'sessions', label: 'Sessions', value: String(detail.sessions), detail: null },
        { id: 'sets', label: 'Logged sets', value: String(detail.loggedSets), detail: 'Warm-ups excluded' },
        { id: 'heaviest', label: 'Heaviest set', value: formatWeight(detail.heaviest, unit), detail: null },
        { id: 'best', label: 'Best est. 1RM', value: formatWeight(detail.bestSets[0]?.e1rm ?? null, unit), detail: null },
      ],
    })),
    chart: section('exercise chart', () => ({
      title: 'Estimated 1RM over time',
      caption: `Best set per session, Epley: weight x (1 + reps / 30), 1 to 12 reps, in ${unit}.`,
      emptyText: 'No sets with weight and 1 to 12 reps.',
      points: downsample(detail.e1rmOverTime, MAX_CHART_POINTS).map((p) => ({
        date: p.day,
        sessionId: p.sessionId,
        e1rm: r1(p.e1rm),
        label: `${formatDay(p.day)}: ${formatWeight(p.e1rm, unit)} est. 1RM (${formatWeight(p.weight, unit)} x ${p.reps ?? '-'})`,
      })),
    })),
    sessions: section('exercise sessions', () => ({
      items: [...detail.e1rmOverTime].reverse().map((p) => ({
        date: p.day,
        dateText: formatDay(p.day),
        sessionId: p.sessionId,
        bestSetText: bestSetText(p.weight, p.reps, unit),
        e1rm: r1(p.e1rm),
        e1rmText: formatWeight(p.e1rm, unit),
      })),
    })),
    bestSets: section('exercise best sets', () => ({
      title: 'Best sets',
      caption: 'Top sets by estimated 1RM.',
      items: detail.bestSets.map((s) => ({
        date: s.day,
        dateText: formatDay(s.day),
        sessionId: s.sessionId,
        weightText: formatWeight(s.weight, unit),
        repsText: s.reps == null ? '-' : String(s.reps),
        e1rm: s.e1rm == null ? null : r1(s.e1rm),
        e1rmText: formatWeight(s.e1rm, unit),
      })),
    })),
  };
}


/**
 * The top-level sections of a response that failed (`{ ok: false }`), for the health check: the routes hide a
 * failed section from the phone, the check must not.
 * @param {Record<string, unknown>} body
 */
export function failedSections(body) {
  return Object.entries(body)
    .filter(([, v]) => v !== null && typeof v === 'object' && /** @type {{ ok?: unknown }} */ (v).ok === false)
    .map(([k]) => k);
}
