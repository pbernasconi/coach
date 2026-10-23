import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, exerciseDetail, exerciseList, sessionDetail, weeklyVolume } from './stats.mjs';
import { liftOverview } from './overview.mjs';
import { MAX_CHART_POINTS, appLink, downsample, exerciseResponse, failedSections, liftResponse, section, sessionResponse, weeklyResponse } from './app-api.mjs';

// Synthetic data only. Today is Tuesday 2026-10-20.
const TODAY = '2026-10-20';
const NOW = new Date('2026-10-20T20:00:00Z');
const CURL = 'AAAAAAAA-0000-0000-0000-00000000000C';
const SQUAT = 'AAAAAAAA-0000-0000-0000-00000000000D';
const PULLUP = 'AAAAAAAA-0000-0000-0000-00000000000E';

function data() {
  const exercises = [
    { id: CURL, name: 'EZ-bar curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'barbell' },
    { id: SQUAT, name: 'Back squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: [] },
    { id: PULLUP, name: 'Pull-up', primaryMuscles: ['back'], secondaryMuscles: ['biceps'] },
  ];
  const sessions = [
    { id: 'S1', day: '2026-10-06', title: 'Upper', startedAt: '2026-10-06T17:00:00Z', finishedAt: '2026-10-06T17:50:00Z' },
    { id: 'S2', day: '2026-10-13', title: 'Upper', startedAt: '2026-10-13T17:00:00Z', finishedAt: '2026-10-13T17:45:00Z' },
    { id: 'S3', day: TODAY, title: 'Upper', startedAt: '2026-10-20T20:32:00Z', finishedAt: '2026-10-20T21:30:00Z', note: 'Good day' },
    { id: 'PLAN', day: '2026-10-23', title: 'Lower' },
  ];
  const sessionExercises = [
    { id: 'e1', sessionID: 'S1', exerciseID: CURL, position: 0 },
    { id: 'e2', sessionID: 'S2', exerciseID: CURL, position: 0 },
    { id: 'e3', sessionID: 'S3', exerciseID: CURL, position: 0, restSeconds: 90, note: 'Slow down' },
    { id: 'e4', sessionID: 'S3', exerciseID: PULLUP, position: 1, loadMode: 'bodyweight' },
    { id: 'e0', sessionID: 'S2', exerciseID: PULLUP, position: 1, loadMode: 'bodyweight' },
    { id: 'e5', sessionID: 'PLAN', exerciseID: SQUAT, position: 0 },
  ];
  const set = (id, se, reps, weight, extra = {}) => ({
    id, sessionExerciseID: se, actualReps: reps, actualWeight: weight, unit: 'kg', kind: 'working', status: 'done', ...extra,
  });
  const sets = [
    set('a1', 'e1', 10, 30, { position: 0 }),
    set('b1', 'e2', 10, 32.5, { position: 0, targetRepMax: 10 }),
    set('c0', 'e3', 12, 15, { position: 0, kind: 'warmUp' }),
    set('c1', 'e3', 10, 37.5, { position: 1, targetReps: 10, targetWeight: 35, rpe: 8.5 }),
    set('c2', 'e3', null, null, { position: 2, status: 'planned', targetRepMin: 8, targetRepMax: 10, targetWeight: 35 }),
    set('p0', 'e0', 8, 10, { position: 0 }),
    set('p1', 'e4', 8, 12.5, { position: 0, targetReps: 8, targetWeight: 10 }),
    set('q1', 'e5', null, null, { position: 0, status: 'planned', targetReps: 5, targetWeight: 100 }),
  ];
  return { exercises, sessions, sessionExercises, sets };
}

const model = () => buildModel(data());

function overview() {
  const m = model();
  return { overview: liftOverview(m, 'kg', TODAY, { strengthTarget: 2, weightKg: 80 }), exercises: exerciseList(m, 'kg') };
}

test('appLink maps web links to app targets and drops web-only pages', () => {
  assert.deepEqual(appLink('/lift/sessions/ABC-1'), { kind: 'session', sessionId: 'abc-1' });
  assert.deepEqual(appLink(`/lift/exercises/${encodeURIComponent('name-farmer walk')}`), { kind: 'exercise', exerciseKey: 'name-farmer walk' });
  assert.deepEqual(appLink('/plan'), { kind: 'week' });
  assert.deepEqual(appLink('#muscles'), { kind: 'section', section: 'muscles' });
  assert.equal(appLink('/health'), null);
  assert.equal(appLink('/settings'), null);
  assert.equal(appLink(undefined), null);
});

test('section: a failing build is { ok: false }, the others stay', () => {
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(section('x', () => { throw new Error('boom'); }), { ok: false });
  } finally {
    console.error = original;
  }
  assert.deepEqual(section('y', () => ({ a: 1 })), { ok: true, a: 1 });
});

test('downsample keeps the first and the last point', () => {
  const list = Array.from({ length: 500 }, (_, i) => i);
  const out = downsample(list, MAX_CHART_POINTS);
  assert.equal(out.length, MAX_CHART_POINTS);
  assert.equal(out[0], 0);
  assert.equal(out.at(-1), 499);
  assert.equal(downsample([1, 2], 10).length, 2);
});

test('liftResponse: the week hero, as the web shows it', () => {
  const body = liftResponse({ ...overview(), timeZone: 'America/Los_Angeles', today: TODAY, now: NOW });
  assert.deepEqual(failedSections(body), []);
  assert.equal(body.unit, 'kg');
  assert.equal(body.empty, null);
  const w = body.week;
  assert.ok(w.ok);
  assert.equal(w.title, 'This week · Oct 19–Oct 25');
  assert.equal(w.doneText, '1 / 2');
  assert.equal(w.progress, 0.5);
  assert.equal(w.days.length, 7);
  assert.deepEqual(w.days.map((d) => d.state), ['none', 'done', 'none', 'none', 'planned', 'none', 'none']);
  assert.equal(w.days[1].today, true);
  assert.equal(w.days[1].sessionId, 's3');
  assert.equal(w.days[4].sessionId, 'plan');
  assert.equal(w.days[4].label, 'Friday: Lower planned');
  assert.deepEqual(w.stats.map((s) => [s.label, s.value]), [['Sets', '3'], ['Volume', '475 kg'], ['Last lift', 'today'], ['Streak', '0 weeks']]);
  assert.deepEqual(w.next, { sessionId: 'plan', date: '2026-10-23', title: 'Lower', whenText: 'Next up · Fri, Oct 23', detail: '1 exercises · 1 sets planned' });
});

test('liftResponse: tips carry app links, never web URLs', () => {
  const body = liftResponse({ ...overview(), timeZone: 'America/Los_Angeles', today: TODAY, now: NOW });
  assert.ok(body.tips.ok);
  const byId = Object.fromEntries(body.tips.items.map((t) => [t.id, t]));
  assert.deepEqual(byId.week.link, { kind: 'session', sessionId: 'plan' });
  assert.deepEqual(byId.arms.link, { kind: 'section', section: 'muscles' });
  assert.equal(byId.protein.link, null); // the web links to /health
  for (const t of body.tips.items) assert.ok(['good', 'warn', 'info'].includes(t.tone));
});

test('liftResponse: main lifts, muscles, sessions, consistency, records', () => {
  const body = liftResponse({ ...overview(), timeZone: 'America/Los_Angeles', today: TODAY, now: NOW });
  const curl = body.lifts.items.find((l) => l.name === 'EZ-bar curl');
  assert.equal(curl.exerciseKey, `id-${CURL.toLowerCase()}`);
  assert.equal(curl.e1rmText, '50');
  assert.equal(curl.newBest, true);
  assert.equal(curl.changeText, '▲ 25% in 12 weeks');
  assert.equal(curl.lastText, 'Last 38 kg × 10 · Oct 20');
  assert.equal(curl.points.length, 3);
  assert.equal(curl.points[2].sessionId, 's3');

  assert.deepEqual(body.muscles.arms.map((r) => r.muscle), ['biceps', 'triceps']);
  assert.equal(body.muscles.arms[0].weekText, '1.5');
  assert.equal(body.muscles.arms[0].status, 'below');
  assert.ok(body.muscles.other.some((r) => r.muscle === 'chest')); // major muscles always listed

  assert.deepEqual(body.sessions.upcoming.map((u) => [u.sessionId, u.badge]), [['plan', 'Planned']]);
  const s3 = body.sessions.logged[0];
  assert.equal(s3.sessionId, 's3');
  assert.equal(s3.meta, '2 exercises · 3 sets · 58 min');
  assert.equal(s3.volumeText, '475');
  assert.equal(s3.relative, 1);
  assert.equal(s3.prText, '2 PRs'); // curl and pull-up

  const c = body.consistency;
  assert.equal(c.heatmap.length, 16);
  assert.ok(c.heatmap.every((w) => w.days.length === 7));
  const today = c.heatmap.at(-1).days[1];
  assert.deepEqual([today.date, today.level, today.today, today.sessionId], [TODAY, 1, true, 's3']);
  assert.equal(c.weeks.items.length, 16);

  assert.equal(body.records.items[0].detail, '38 kg × 10 · Oct 20');
  assert.equal(body.records.items[0].gainText, '+7 kg');
  assert.ok(body.exercises.items.every((e) => e.exerciseKey && e.detail.includes('sessions')));
});

test('liftResponse: the simple overview (summary, focus, targeting, progress, one note)', () => {
  const body = liftResponse({ ...overview(), timeZone: 'UTC', today: TODAY, now: NOW });
  assert.match(body.summary.text, /^\d of \d sessions? this week$/);
  assert.ok(body.focus.muscles.length > 0 && body.focus.muscles.every((m) => m.name[0] === m.name[0].toUpperCase()));
  assert.equal(body.targeting.items.length, body.focus.muscles.length);
  for (const t of body.targeting.items) {
    assert.ok(['inRange', 'above', 'onTrack', 'below'].includes(t.status));
    assert.ok(t.text.includes('done'));
  }
  for (const p of body.progress.items) {
    assert.ok(['up', 'down', 'same'].includes(p.tone));
    assert.ok(p.points.length <= 12);
  }
  assert.ok(body.note.item === null || body.note.item.tone !== 'info');
});

test('liftResponse: a failed Lift model fails every section, not the response', () => {
  const body = liftResponse({ overview: null, exercises: null, timeZone: 'UTC', today: TODAY, now: NOW });
  assert.deepEqual(failedSections(body).sort(), [
    'consistency', 'exercises', 'focus', 'lifts', 'muscles', 'note', 'progress', 'records', 'sessions', 'summary', 'targeting', 'tips', 'week',
  ]);
});

test('liftResponse: no sessions gives the empty state', () => {
  const m = buildModel({ exercises: [], sessions: [], sessionExercises: [], sets: [] });
  const body = liftResponse({ overview: liftOverview(m, 'kg', TODAY), exercises: [], timeZone: 'UTC', today: TODAY, now: NOW });
  assert.equal(body.empty.title, 'No sessions yet');
  assert.deepEqual(failedSections(body), []);
});

test('weeklyResponse: newest week first, volume text and bar length', () => {
  const m = model();
  const body = weeklyResponse({ weeks: weeklyVolume(m, 'kg'), unit: 'kg', now: NOW });
  assert.ok(body.weeks.ok);
  assert.deepEqual(body.weeks.items.map((w) => w.week), ['2026-10-19', '2026-10-12', '2026-10-05']);
  assert.equal(body.weeks.items[0].volumeText, '475 kg');
  assert.equal(body.weeks.items[0].relative, 1);
  assert.equal(body.weeks.items[0].weekText, 'Mon, Oct 19, 2026');
  assert.deepEqual(weeklyResponse({ weeks: null, unit: null, now: NOW }).weeks, { ok: false });
});

test('sessionResponse: hero and exercise cards, as the session page', () => {
  const m = model();
  const d = sessionDetail(m, 's3', 'kg');
  const rich = { ...d, exercises: d.exercises.map((e) => ({ ...e, media: null })) };
  const body = sessionResponse({ session: rich, timeZone: 'America/Los_Angeles', now: NOW });
  assert.deepEqual(failedSections(body), []);
  assert.equal(body.olderId, 's2');
  assert.equal(body.newerId, 'plan');
  const h = body.hero;
  assert.equal(h.kicker, 'Strength · Tue, Oct 20, 2026 · 1:32 PM');
  assert.equal(h.state, 'done');
  assert.equal(h.stateLabel, 'Done');
  assert.deepEqual(h.ring, { logged: 3, total: 4, progress: 0.75, text: '3/4', caption: 'sets logged' });
  assert.deepEqual(h.stats.map((s) => s.value), ['2', '3 / 4', '710 kg', '475 kg', '58 min']);
  assert.equal(h.muscles[0].muscle, 'biceps');

  const [curl, pull] = body.exercises.items;
  assert.equal(curl.setsText, '1/2 sets');
  assert.equal(curl.restText, '1:30 rest');
  assert.equal(curl.equipment, 'Barbell');
  assert.deepEqual(curl.sets.map((s) => [s.label, s.text, s.targetText]), [
    ['Warm-up', '15 kg × 12', 'target –'],
    ['Set 1', '37.5 kg × 10', 'target 35 kg × 10'],
    ['Set 2', '35 kg × 8–10', null],
  ]);
  assert.equal(curl.sets[1].beatTarget, true);
  assert.equal(curl.sets[1].rpeText, 'RPE 8.5');
  assert.equal(curl.sets[2].rpeText, null);
  assert.equal(curl.lastTime.sessionId, 's2');
  assert.equal(curl.lastTime.deltaText, '+2.5 kg vs last');
  assert.deepEqual(curl.lastTime.sets, ['32.5 kg × 10']);
  assert.equal(curl.best.text, '43 kg');
  assert.deepEqual(curl.trend.values, [40, 43.3]);

  // Bodyweight work: added load, no estimated 1RM.
  assert.equal(pull.sets[0].text, '+12.5 kg × 8');
  assert.equal(pull.best, null);
  assert.equal(pull.trend, null);
  assert.equal(pull.media, null);
});

test('exerciseResponse: stat cards, chart points with session ids, newest session first', () => {
  const m = model();
  const key = `id-${CURL.toLowerCase()}`;
  const body = exerciseResponse({ detail: exerciseDetail(m, key, 'kg'), unit: 'kg', now: NOW });
  assert.deepEqual(failedSections(body), []);
  assert.equal(body.name, 'EZ-bar curl');
  assert.deepEqual(body.stats.items.map((s) => s.value), ['3', '3', '37.5 kg', '50 kg']);
  assert.deepEqual(body.chart.points.map((p) => p.sessionId), ['s1', 's2', 's3']);
  assert.deepEqual(body.sessions.items.map((r) => [r.sessionId, r.bestSetText]), [['s3', '37.5 kg x 10'], ['s2', '32.5 kg x 10'], ['s1', '30 kg x 10']]);
  assert.equal(body.bestSets.items[0].e1rmText, '50 kg');
});
