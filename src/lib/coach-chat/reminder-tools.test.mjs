import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addReminder, cleanReminder, dropReminder, reminderText, upcoming, zonedInstant } from './reminder-tools.mjs';
import { checkProposalInput, recheck, undoPlan } from './changes.mjs';

const LA = 'America/Los_Angeles';
// Tue 3 Nov 2026 15:00 in San Francisco (PST, UTC-8).
const nowMs = Date.parse('2026-11-03T23:00:00Z');

test('a time on his clock becomes the instant, across daylight saving', () => {
  assert.equal(zonedInstant('2026-11-04T18:00', LA)?.toISOString(), '2026-11-05T02:00:00.000Z');
  assert.equal(zonedInstant('2026-10-30T18:00', LA)?.toISOString(), '2026-10-31T01:00:00.000Z');
  assert.equal(zonedInstant('2026-11-04T18:00', 'Europe/Zurich')?.toISOString(), '2026-11-04T17:00:00.000Z');
  assert.equal(zonedInstant('2026-02-30T08:00', LA), null);
  assert.equal(zonedInstant('tomorrow', LA), null);
});

test('a reminder is later, within 30 days, one short line', () => {
  const r = cleanReminder({ at: '2026-11-04T18:00', text: '  Physio A:  Achilles and calf ' }, { timeZone: LA, nowMs });
  assert.ok('change' in r);
  assert.equal(r.change.at, '2026-11-05T02:00:00Z');
  assert.equal(r.change.text, 'Physio A: Achilles and calf');
  assert.equal(reminderText(r.change), 'Wed 4 Nov 18:00 · on your iPhone');
  assert.match(cleanReminder({ at: '2026-11-03T14:00', text: 'x y' }, { timeZone: LA, nowMs }).problem, /passed/);
  assert.match(cleanReminder({ at: '2026-12-20T08:00', text: 'x y' }, { timeZone: LA, nowMs }).problem, /30 days/);
  assert.match(cleanReminder({ at: '2026-11-04T08:00', text: '' }, { timeZone: LA, nowMs }).problem, /words/);
});

test('the stored list: old ones drop on the next write, Undo takes one out, the phone gets what is to come', () => {
  const old = { id: 'old', at: '2026-10-01T10:00:00Z', text: 'a' };
  const recent = { id: 'recent', at: '2026-11-02T10:00:00Z', text: 'b' };
  const later = { id: 'later', at: '2026-11-06T10:00:00Z', text: 'c' };
  const list = addReminder([old, recent, 'junk'], later, nowMs);
  assert.deepEqual(list.map((r) => r.id), ['recent', 'later']);
  assert.deepEqual(dropReminder(list, 'later').map((r) => r.id), ['recent']);
  assert.deepEqual(upcoming([later, recent], nowMs), [later]);
});

test('on the card: a Reminders section, through the recheck, and Undo always runs', () => {
  const plan = { rows: [], today: '2026-11-03', timeZone: LA, nowMs };
  const r = checkProposalInput({ title: 'Physio reminder', why: 'You asked', changes: [{ op: 'reminder', at: '2026-11-04T18:00', text: 'Physio A' }] }, plan, 1);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.value.card.days.map((d) => [d.label, d.rows[0].tag, d.rows[0].time]), [['Reminders', 'Reminder', '18:00']]);
  assert.deepEqual(recheck(r.value.changes, { rows: [], today: '2026-11-03' }, []), []);
  assert.equal(undoPlan([{ op: 'unremind', id: 'x' }], {}, []).run.length, 1);
});
