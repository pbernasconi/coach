import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeek } from './current-week.mjs';

test('the current week lists each workout with its status, and how it felt', () => {
  const t = formatWeek({
    weekStart: '2026-10-26',
    title: 'Build week',
    rows: [
      { id: 'w1', scheduled_date: new Date('2026-10-26T00:00:00Z'), start_time: '07:00', title: 'VO2 A', intensity: '5×3', duration: 60, tss: 80, status: 'planned' },
      { id: 'w2', scheduled_date: '2026-10-27', start_time: null, title: 'Heavy barbell', duration: 50, tss: 40, status: 'skipped', skip_reason: 'busy', edited_at: new Date() },
    ],
    felt: [{ date: '2026-10-26', title: 'VO2 A', feel: 4, rpe: 8, comment: null }],
  });
  assert.match(t, /^Week of 2026-10-26: Build week/);
  assert.match(t, /w1 {2}2026-10-26 07:00 {2}VO2 A \(5×3, 60 min, 80 TSS\)$/m);
  assert.match(t, /w2 {2}2026-10-27 --:-- {2}Heavy barbell .*\[SKIPPED \(busy\); changed on the web\]/);
  assert.match(t, /How it went:\n {2}2026-10-26 {2}VO2 A: /);
});
