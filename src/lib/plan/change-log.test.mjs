import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeLine, describeChange, sourceLabel } from './change-log.mjs';

test('describeChange: insert, delete, move, skip, link, edits', () => {
  assert.equal(describeChange({ op: 'insert', title: 'Heavy barbell', after: { scheduled_date: '2026-10-26T00:00:00' } }), 'added Heavy barbell on Mon Oct 26');
  assert.equal(describeChange({ op: 'delete', title: 'Heavy barbell', before: { scheduled_date: '2026-10-28T00:00:00' } }), 'removed Heavy barbell from Wed Oct 28');
  assert.equal(
    describeChange({ op: 'update', title: 'Heavy barbell', before: { scheduled_date: '2026-10-26T00:00:00', plan_id: 'a' }, after: { scheduled_date: '2026-10-27T00:00:00', plan_id: 'a' } }),
    'moved Heavy barbell from Mon Oct 26 to Tue Oct 27'
  );
  assert.equal(describeChange({ op: 'update', title: 'VO2', before: { status: 'planned' }, after: { status: 'skipped', skip_reason: 'tired' } }), 'skipped VO2 (tired)');
  assert.equal(describeChange({ op: 'update', title: 'Lift', before: { lift_session_id: null }, after: { lift_session_id: 'x' } }), 'linked a Lift session to Lift');
  assert.equal(describeChange({ op: 'update', title: 'Run', before: { duration: 30, tss: 20 }, after: { duration: 45, tss: 30 } }), 'changed duration, TSS of Run');
  assert.equal(describeChange({ op: 'update', title: 'Run 2', before: { title: 'Run' }, after: { title: 'Run 2' } }), 'renamed Run to Run 2');
});

test('changeLine: time in the zone, source label', () => {
  assert.equal(
    changeLine({ at: '2026-10-27T16:12:00Z', source: 'chat', op: 'update', title: 'Heavy barbell', before: { scheduled_date: '2026-10-26' }, after: { scheduled_date: '2026-10-27' } }, 'America/Los_Angeles'),
    'Tue Oct 27 09:12 · Coach chat · moved Heavy barbell from Mon Oct 26 to Tue Oct 27'
  );
  assert.equal(sourceLabel('weird'), 'weird');
});
