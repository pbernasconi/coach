import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OUT, render } from '../../../scripts/planner-prompt.mjs';
import { SUBMIT_TOOL, systemPrompt, userMessage } from './prompt.mjs';

test('the prompt bundle is up to date (run node scripts/planner-prompt.mjs)', () => {
  assert.equal(readFileSync(OUT, 'utf8'), render());
});

test('the system prompt holds the four prompt files in order and is the same every call', () => {
  const s = systemPrompt();
  assert.equal(s, systemPrompt());
  const at = ['# Coach: plan Paolo', '# Coaching rules', '# Check-ins', '# Plan Structure'].map((h) => s.indexOf(h));
  assert.ok(at.every((i) => i >= 0), String(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(s, /submit_plan/);
  assert.match(s, /## Weather/);
  assert.match(s, /## Safety/);
});

test('the prompts have no local or GitHub planning left', () => {
  const s = systemPrompt();
  for (const gone of ['--env-file', 'AskUserQuestion', 'plan-import', 'coach-profile', 'plans/request.json', '.claude/commands', 'GitHub job']) {
    assert.ok(!s.includes(gone), gone);
  }
});

test('the user message has the request, the revision note and the profile', () => {
  const m = userMessage({ request: { kind: 'weekly', weekStart: '2026-10-26' }, profileMd: 'PROFILE', revise: { note: 'less running', plan: { a: 1 } } });
  assert.match(m, /<request>[\s\S]*2026-10-26/);
  assert.match(m, /<paolo_note>\nless running/);
  assert.match(m, /<profile>\nPROFILE/);
  assert.ok(!m.includes('<current_week>'));
  assert.ok(!userMessage({ request: { weekStart: '2026-10-26' }, profileMd: 'P' }).includes('paolo_note'));
});

test('a check-in message names today and holds the current week', () => {
  const m = userMessage({ request: { kind: 'checkin', weekStart: '2026-10-26' }, profileMd: 'P', today: '2026-10-28', currentWeek: 'Week of 2026-10-26' });
  assert.match(m, /Today is 2026-10-28/);
  assert.match(m, /<current_week>\nWeek of 2026-10-26\n<\/current_week>/);
});

test('submit_plan streams its input and needs a plan and summary', () => {
  assert.equal(SUBMIT_TOOL.eager_input_streaming, true);
  assert.deepEqual(SUBMIT_TOOL.input_schema.required, ['plan', 'summary']);
});
