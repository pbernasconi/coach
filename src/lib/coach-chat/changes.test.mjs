import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNote, checkProposalInput, cleanChanges, describeChanges, dropNote, fatigueIssues, isStale, basisOf, newRuleIssues, NOTES_HEADING, planText, simulate } from './changes.mjs';

// Mon 26 Oct 2026: the day Paolo asked to move the heavy lift to Tuesday and run easy with David instead.
const today = '2026-10-26';
const row = (id, date, startTime, title, sport, workoutType, extra = {}) => ({
  id, date, startTime, title, sport, workoutType, intensity: null, duration: 60, status: 'planned', state: date === today ? 'today' : 'planned', ...extra,
});
const rows = [
  row('sun', '2026-10-25', '08:00:00', 'Long run', 'run', 'run-long', { state: 'done' }),
  row('spin', today, '07:00:00', 'Recovery spin', 'ride', 'recovery', { duration: 40 }),
  row('heavy', today, '17:00:00', 'Heavy barbell', 'strength', 'strength-heavy'),
  row('vo2', '2026-10-27', '09:00:00', 'VO2 B', 'run', 'run-vo2', { intensity: 'Very hard' }),
  row('upper', '2026-10-29', '17:00:00', 'Upper + arms', 'strength', 'strength-upper'),
  row('test', '2026-10-30', '08:00:00', '10k test', 'run', 'run-test', { intensity: 'Very hard' }),
];
const plan = { rows, today };

test('cleans the four ops of the David day', () => {
  const { changes, problems } = cleanChanges([
    { op: 'move', id: 'heavy', date: '2026-10-27', startTime: '09:00' },
    { op: 'skip', id: 'vo2', reason: 'Busy' },
    { op: 'skip', id: 'spin', reason: 'nope' },
    { op: 'add', date: today, sport: 'run', startTime: '16:00', title: 'Easy run with David', duration: 45 },
  ], plan);
  assert.deepEqual(problems, []);
  assert.deepEqual(changes[1], { op: 'skip', id: 'vo2', reason: 'busy' });
  assert.equal(changes[2].reason, 'other');
  assert.equal(changes[3].effort, 'easy');
});

test('refuses unknown ids, done workouts, the past, the far future and bad times', () => {
  const { problems } = cleanChanges([
    { op: 'move', id: 'nope', date: '2026-10-27' },
    { op: 'move', id: 'sun', date: '2026-10-27' },
    { op: 'move', id: 'heavy', date: '2026-10-20' },
    { op: 'add', date: '2026-12-30', sport: 'run', title: 'x', duration: 30 },
    { op: 'add', date: today, sport: 'run', title: 'x', duration: 30, startTime: '25:00' },
    { op: 'add', date: today, sport: 'dance', title: 'x', duration: 30 },
  ], plan);
  assert.equal(problems.length, 6);
  assert.match(problems[0], /no workout with id nope/);
  assert.match(problems[1], /done/);
  assert.match(problems[2], /past/);
  assert.match(problems[3], /more than 21 days/);
  assert.match(problems[4], /HH:MM/);
  assert.match(problems[5], /sport/);
});

test('refuses two changes to one workout, a no-op move and an empty update', () => {
  const { problems } = cleanChanges([
    { op: 'skip', id: 'vo2', reason: 'busy' },
    { op: 'move', id: 'vo2', date: '2026-10-28' },
    { op: 'move', id: 'heavy', date: today },
    { op: 'update', id: 'upper' },
  ], plan);
  assert.equal(problems.length, 3);
  assert.match(problems[0], /more than one change/);
  assert.match(problems[1], /already on/);
  assert.match(problems[2], /nothing to change/);
  assert.deepEqual(cleanChanges([], plan).problems, ['changes must be a list of 1 or more changes']);
});

test('a move keeps the time unless it names one', () => {
  const { changes } = cleanChanges([{ op: 'move', id: 'heavy', date: '2026-10-28' }], plan);
  assert.equal(changes[0].startTime, '17:00');
});

test('the card rows read before → after', () => {
  const { changes } = cleanChanges([
    { op: 'move', id: 'heavy', date: '2026-10-27', startTime: '09:00' },
    { op: 'skip', id: 'vo2', reason: 'busy' },
    { op: 'add', date: today, sport: 'run', startTime: '16:00', title: 'Easy run with David', duration: 45 },
    { op: 'update', id: 'upper', duration: 45, effort: 'moderate' },
  ], plan);
  assert.deepEqual(describeChanges(changes, rows), [
    { kind: 'changed', title: 'Heavy barbell', detail: 'Mon 26 Oct 17:00 → Tue 27 Oct 09:00' },
    { kind: 'removed', title: 'VO2 B', detail: 'Skip · Tue 27 Oct 09:00 · busy' },
    { kind: 'added', title: 'Easy run with David', detail: 'Mon 26 Oct 16:00 · 45 min · Easy' },
    { kind: 'changed', title: 'Upper + arms', detail: 'Thu 29 Oct · 60 → 45 min, ? → Moderate' },
  ]);
});

test('the rule check flags a heavy lift on a VO2 day, and not when VO2 is skipped', () => {
  const move = { op: 'move', id: 'heavy', date: '2026-10-27', startTime: '10:30' };
  const alone = cleanChanges([move], plan).changes;
  assert.ok(newRuleIssues(rows, alone, today).some((m) => m.startsWith('R3')));
  const fixed = cleanChanges([move, { op: 'skip', id: 'vo2', reason: 'busy' }], plan).changes;
  assert.ok(!newRuleIssues(rows, fixed, today).some((m) => m.startsWith('R3')));
  // A run after the lift on the same day breaks R2.
  const after = cleanChanges([{ op: 'add', date: today, sport: 'run', startTime: '18:30', title: 'Run', duration: 30 }], plan).changes;
  assert.ok(newRuleIssues(rows, after, today).some((m) => m.startsWith('R2')));
});

test('a proposal that breaks a rule goes back once, then shows with the warning', () => {
  const input = { title: 'Lift tomorrow', why: 'Based on your note', changes: [{ op: 'move', id: 'heavy', date: '2026-10-27', startTime: '10:30' }] };
  const first = checkProposalInput(input, plan, 1);
  assert.equal(first.ok, false);
  assert.match(first.problems.at(-1), /on purpose/);
  const second = checkProposalInput(input, plan, 2);
  assert.equal(second.ok, true);
  assert.ok(second.value.warnings.length);
  assert.deepEqual(Object.keys(second.value.basis), ['heavy']);
  assert.equal(checkProposalInput({ ...input, title: '' }, plan, 1).problems[0], 'title is missing');
});

test('simulate moves, skips, adds and removes', () => {
  const { changes } = cleanChanges([
    { op: 'move', id: 'heavy', date: '2026-10-27', startTime: '09:00' },
    { op: 'remove', id: 'spin' },
    { op: 'add', date: today, sport: 'run', title: 'Easy run', duration: 45 },
  ], plan);
  const after = simulate(rows, changes);
  assert.equal(after.find((r) => r.id === 'heavy').date, '2026-10-27');
  assert.ok(!after.some((r) => r.id === 'spin'));
  assert.ok(after.some((r) => r.id === 'new-2' && r.title === 'Easy run'));
  assert.equal(rows.find((r) => r.id === 'heavy').date, today, 'rows stay as they were');
});

test('a proposal is stale when a workout it touches changed, went or got done', () => {
  const { changes } = cleanChanges([{ op: 'move', id: 'heavy', date: '2026-10-27' }], plan);
  const basis = basisOf(changes, rows);
  assert.equal(isStale(basis, rows), false);
  assert.equal(isStale(basis, rows.map((r) => (r.id === 'heavy' ? { ...r, startTime: '18:00:00' } : r))), true);
  assert.equal(isStale(basis, rows.map((r) => (r.id === 'heavy' ? { ...r, state: 'done' } : r))), true);
  assert.equal(isStale(basis, rows.filter((r) => r.id !== 'heavy')), true);
});

test('the plan text names ids and states', () => {
  const text = planText(rows.map((r) => (r.id === 'vo2' ? { ...r, status: 'skipped', skipReason: 'busy' } : r)), today);
  assert.match(text, /^sun {2}2026-10-25 Sun 08:00 {2}Long run \(run, 60 min\) {2}\[DONE\]/);
  assert.match(text, /heavy {2}2026-10-26 Mon 17:00 {2}Heavy barbell .*\[TODAY\]/);
  assert.match(text, /VO2 B .*\[SKIPPED \(busy\)\]/);
  assert.equal(planText([], today), 'No workouts planned.');
});

test('a remember change is one line for Coaching preferences, shown on the card', () => {
  const { changes, problems } = cleanChanges([{ op: 'remember', text: '  Never a run\n after a lift ' }, { op: 'remember', text: 'x' }], plan);
  assert.equal(problems.length, 1);
  assert.deepEqual(changes, [{ op: 'remember', text: 'Never a run after a lift' }]);
  assert.deepEqual(describeChanges(changes, rows), [{ kind: 'added', title: 'Coaching preference', detail: 'Never a run after a lift' }]);
  assert.deepEqual(simulate(rows, changes), rows);
  assert.deepEqual(basisOf(changes, rows), {});
});

test('addNote puts lines under the chat heading and dropNote takes only that line out', () => {
  const one = addNote('# Week\n- Bike club Thu\n', 'David runs Mondays');
  assert.equal(one, `# Week\n- Bike club Thu\n\n${NOTES_HEADING}\n- David runs Mondays\n`);
  const two = addNote(one, 'No lifts on travel days');
  assert.match(two, /- David runs Mondays\n- No lifts on travel days\n$/);
  assert.equal(addNote('', 'A'), `${NOTES_HEADING}\n- A\n`);
  // A section after the chat one: the line still goes under the chat heading.
  const mid = addNote(`${NOTES_HEADING}\n- A\n\n## Later\n- B\n`, 'C');
  assert.match(mid, /- A\n- C\n\n## Later/);
  assert.equal(dropNote(two, 'No lifts on travel days'), one);
  assert.equal(dropNote(dropNote(two, 'No lifts on travel days'), 'David runs Mondays').trim(), '# Week\n- Bike club Thu');
  assert.equal(dropNote('# Edited by hand\n', 'gone'), '# Edited by hand\n');
});

test('a tired skip of today must ease a quality session tomorrow', () => {
  const tired = [{ op: 'skip', id: 'heavy', reason: 'tired' }];
  assert.equal(fatigueIssues(rows, cleanChanges(tired, plan).changes, today).length, 1);
  const first = checkProposalInput({ title: 'Rest today', why: 'Based on…', changes: tired }, plan, 1);
  assert.equal(first.ok, false);
  assert.ok(first.problems.some((p) => /fatigue: .*VO2 B/.test(p)));
  // Easing tomorrow in the same card is fine.
  const swapped = [...tired, { op: 'skip', id: 'vo2', reason: 'tired' }, { op: 'add', date: '2026-10-27', sport: 'run', startTime: '09:00', title: 'Easy run', duration: 40 }];
  assert.deepEqual(fatigueIssues(rows, cleanChanges(swapped, plan).changes, today), []);
  const moved = [...tired, { op: 'move', id: 'vo2', date: '2026-10-28' }];
  assert.deepEqual(fatigueIssues(rows, cleanChanges(moved, plan).changes, today), []);
  // Busy says nothing about fatigue; a later day's tired skip doesn't count either.
  assert.deepEqual(fatigueIssues(rows, cleanChanges([{ op: 'skip', id: 'heavy', reason: 'busy' }], plan).changes, today), []);
  assert.deepEqual(fatigueIssues(rows, cleanChanges([{ op: 'skip', id: 'upper', reason: 'sore' }], plan).changes, today), []);
  // Kept on a second try (Paolo asked for it): a warning on the card.
  const kept = checkProposalInput({ title: 'Rest today', why: 'He asked', changes: tired }, plan, 2);
  assert.equal(kept.ok, true);
  assert.ok(kept.value.warnings.some((w) => /fatigue/.test(w)));
});

// Paolo, 2026-10-27: a chat-made heavy lift showed its whole warm-up crammed into the Back squat note.
const WARM_UP = 'Warm up, about 12 min. 1) 5 min stair climber, easy. 2) Mobility, 1 round: 10 slow air squats. 4) Ramp sets: empty bar x 10, 50% x 5, then the work sets.';
const templates = ['Heavy barbell', 'Upper (dumbbells)', 'Hotel gym (dumbbells)'];

test('an added gym lift names its Lift template and gets its workout type', () => {
  const { changes, problems } = cleanChanges([
    { op: 'add', date: '2026-10-28', sport: 'strength', startTime: '11:00', title: 'Heavy barbell lift', duration: 75, effort: 'hard', liftTemplate: 'heavy barbell', description: 'Squat is the priority.' },
    { op: 'add', date: '2026-10-31', sport: 'strength', title: 'Upper', duration: 60, liftTemplate: 'Upper (dumbbells)' },
  ], { ...plan, templates });
  assert.deepEqual(problems, []);
  assert.equal(changes[0].liftTemplate, 'Heavy barbell');
  assert.equal(changes[0].workoutType, 'strength-heavy');
  assert.equal(changes[1].workoutType, 'strength-dumbbell');
  assert.match(describeChanges(changes, rows)[0].detail, /Heavy barbell/);
  assert.equal(simulate(rows, changes).find((r) => r.id === 'new-0').workoutType, 'strength-heavy');
});

test('refuses a strength workout written out by hand', () => {
  const { problems } = cleanChanges([
    { op: 'add', date: '2026-10-28', sport: 'strength', title: 'Heavy barbell lift', duration: 75, description: 'Back squat 3x5 @ 255 lb' },
    { op: 'add', date: '2026-10-28', sport: 'strength', title: 'Heavy barbell lift', duration: 75, liftTemplate: 'Heavy barbell', description: WARM_UP },
    { op: 'add', date: '2026-10-28', sport: 'strength', title: 'Heavy', duration: 75, liftTemplate: 'Legs day' },
    { op: 'add', date: '2026-10-28', sport: 'strength', title: 'Knees', duration: 40, workoutType: 'strength-home', description: 'Do some knee work.' },
    { op: 'update', id: 'heavy', description: WARM_UP },
    { op: 'update', id: 'upper', description: 'x'.repeat(301) },
  ], { ...plan, templates });
  assert.equal(problems.length, 5);
  assert.match(problems[0], /gym lift .*liftTemplate: one of Heavy barbell/);
  assert.match(problems[1], /coach's note only/);
  assert.match(problems[2], /not a Lift template/);
  assert.match(problems[3], /exercise lines/);
  assert.match(problems[4], /change 5: .*coach's note only/);
});

test('a home session is its exercise lines', () => {
  const { changes, problems } = cleanChanges([
    { op: 'add', date: '2026-10-28', sport: 'strength', title: 'Running Knee Strength', duration: 40, workoutType: 'strength-home', description: '1) Dumbbell Bulgarian split squat 3x8: each leg.\n2) Step-up with knee raise 3x8: each leg.' },
  ], { ...plan, templates });
  assert.deepEqual(problems, []);
  assert.equal(changes[0].workoutType, 'strength-home');
  assert.equal(changes[0].liftTemplate, null);
});

test('the plan text names a lift\'s template', () => {
  const text = planText([{ ...rows[2], liftTemplate: 'Heavy barbell' }], today);
  assert.match(text, /Lift template Heavy barbell/);
});

test('an added lift that copies a missed lift of the same template is refused; a planned one is a warning', () => {
  // Tue 27 Oct 2026, 07:09: "the heavy lift moves to Wednesday" came as an add, and Monday's stayed (two Heavy barbells).
  const tue = '2026-10-27';
  const lifts = [
    row('heavy', today, '17:00:00', 'Heavy barbell', 'strength', 'strength-heavy', { liftTemplate: 'Heavy barbell', state: 'missed' }),
    row('vo2', tue, '09:00:00', 'VO2 B', 'run', 'run-vo2', { state: 'today' }),
  ];
  const add = { op: 'add', date: '2026-10-28', sport: 'strength', startTime: '17:00', title: 'Heavy barbell', duration: 60, liftTemplate: 'Heavy barbell' };
  const p = { rows: lifts, today: tue, templates: ['Heavy barbell', 'Upper (dumbbells)'] };
  const refused = checkProposalInput({ title: 'Heavy lift Wed', why: 'x', changes: [add] }, p, 2);
  assert.equal(refused.ok, false);
  assert.match(refused.problems.join('\n'), /move that workout instead .*"heavy"/);
  // What it should have done: move the missed lift itself to Wednesday (a past workout can move to today or later).
  const moved = checkProposalInput({ title: 'Heavy lift Wed', why: 'x', changes: [{ op: 'move', id: 'heavy', date: '2026-10-28', startTime: '11:00' }] }, p, 2);
  assert.equal(moved.ok, true);
  assert.equal(checkProposalInput({ title: 'x', why: 'x', changes: [{ op: 'skip', id: 'heavy', reason: 'busy' }] }, p, 2).ok, false);
  // A planned copy later in the week: back to the model once, then a warning on the card.
  const planned = [{ ...lifts[0], date: '2026-10-30', state: 'planned' }, lifts[1]];
  const first = checkProposalInput({ title: 'Second heavy', why: 'x', changes: [add] }, { ...p, rows: planned }, 1);
  assert.equal(first.ok, false);
  assert.match(first.problems.join('\n'), /already planned this week/);
  const second = checkProposalInput({ title: 'Second heavy', why: 'x', changes: [add] }, { ...p, rows: planned }, 2);
  assert.equal(second.ok, true);
  assert.ok(second.value.warnings.some((w) => /already planned this week/.test(w)));
});
