import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OUT, render } from '../../../scripts/planner-prompt.mjs';
import { SUBMIT_TOOL, systemPrompt, userMessage } from './prompt.mjs';

test('the copied planning rules are up to date (run node scripts/planner-prompt.mjs)', () => {
  assert.equal(readFileSync(OUT, 'utf8'), render());
});

test('the system prompt holds the rules and is the same every call', () => {
  const s = systemPrompt();
  assert.equal(s, systemPrompt());
  assert.match(s, /submit_plan/);
  assert.match(s, /# \.claude\/commands\/plan\.md/);
  assert.match(s, /# plans\/PLAN-STRUCTURE\.md/);
  assert.match(s, /## Weather/);
});

test('the user message has the request, the revision note and the profile', () => {
  const m = userMessage({ request: { weekStart: '2026-10-26' }, profileMd: 'PROFILE', revise: { note: 'less running', plan: { a: 1 } } });
  assert.match(m, /<request>[\s\S]*2026-10-26/);
  assert.match(m, /<paolo_note>\nless running/);
  assert.match(m, /<profile>\nPROFILE/);
  assert.ok(!userMessage({ request: { weekStart: '2026-10-26' }, profileMd: 'P' }).includes('paolo_note'));
});

test('submit_plan streams its input and needs a plan and summary', () => {
  assert.equal(SUBMIT_TOOL.eager_input_streaming, true);
  assert.deepEqual(SUBMIT_TOOL.input_schema.required, ['plan', 'summary']);
});
