import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appLink, webLink } from './destinations.mjs';

test('app links follow lift/PUSH.md', () => {
  assert.equal(appLink({ kind: 'liftSession', id: 'ABC-1' }), 'lift://session/abc-1');
  assert.equal(appLink({ kind: 'activity', id: '123' }), 'lift://activity/123');
  assert.equal(appLink({ kind: 'weighIn', date: '2026-10-22' }), 'lift://weigh-in/2026-10-22');
  assert.equal(appLink({ kind: 'today' }), 'lift://today');
  assert.equal(appLink({ kind: 'coach' }), 'lift://coach');
});

test('web links open the same place on the web app', () => {
  assert.equal(webLink({ kind: 'activity', id: '123' }, 'https://c.example/'), 'https://c.example/activities/123');
  assert.equal(webLink({ kind: 'weighIn', date: '2026-10-22' }, 'https://c.example'), 'https://c.example/health');
});

test('ids that are not ids are refused', () => {
  assert.throws(() => appLink({ kind: 'liftSession', id: 'a/b' }));
  assert.throws(() => appLink({ kind: 'weighIn', date: '2026-1-2' }));
  assert.throws(() => appLink({ kind: 'activity', id: '' }));
});
