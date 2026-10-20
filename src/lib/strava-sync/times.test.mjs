import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityTimes } from './sync.mjs';

test('start times go in as written, whatever the machine time zone', () => {
  const t = activityTimes({ start_date: '2026-10-13T21:34:25Z', start_date_local: '2026-10-14T06:34:25Z' });
  assert.deepEqual(t, { startDate: '2026-10-13T21:34:25', startLocal: '2026-10-14T06:34:25' });
  assert.deepEqual(activityTimes({}), { startDate: null, startLocal: null });
});
