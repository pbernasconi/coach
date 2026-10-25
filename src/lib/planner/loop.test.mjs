import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SUBMITS, planWithClaude } from './loop.mjs';

const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 10000, cache_creation_input_tokens: 0 };
const submit = (plan, id = 't1') => ({ type: 'tool_use', id, name: 'submit_plan', input: { plan, summary: 'sum' } });
const reply = (content, stop_reason = 'tool_use') => ({ content, stop_reason, usage, model: 'claude-opus-5-5' });

/** A fake client that answers each request with the next scripted message and records the requests. */
function fake(replies) {
  const calls = [];
  return {
    calls,
    beta: { messages: { stream: (params) => { calls.push(structuredClone(params)); const r = replies.shift(); return { finalMessage: async () => r }; } } },
  };
}

const okCheck = () => ({ ok: true });

test('saves a plan that passes on the first submit', async () => {
  const client = fake([reply([submit({ v: 1 })])]);
  const r = await planWithClaude({ client, system: 'S', user: 'U', check: okCheck });
  assert.equal(r.stop, 'saved');
  assert.deepEqual(r.plan, { v: 1 });
  assert.equal(r.summary, 'sum');
  assert.deepEqual(r.firstDraftProblems, []);
  assert.equal(r.turns, 1);
  const p = client.calls[0];
  assert.equal(p.system[0].cache_control.ttl, '1h');
  assert.deepEqual(p.tool_choice, { type: 'auto' });
  assert.deepEqual(p.thinking, { type: 'adaptive' });
  assert.ok(r.usage.usd > 0);
});

test('sends the problems back and saves the repaired plan', async () => {
  const client = fake([reply([submit({ v: 1 }, 'a')]), reply([submit({ v: 2 }, 'b')])]);
  const check = (plan) => (plan.v === 2 ? { ok: true } : { ok: false, problems: ['R1: two lifts'], saveable: true });
  const r = await planWithClaude({ client, system: 'S', user: 'U', check });
  assert.equal(r.stop, 'saved');
  assert.deepEqual(r.plan, { v: 2 });
  assert.deepEqual(r.firstDraftProblems, ['R1: two lifts']);
  const last = client.calls[1].messages.at(-1);
  assert.equal(last.role, 'user');
  assert.equal(last.content[0].tool_use_id, 'a');
  assert.equal(last.content[0].is_error, true);
  assert.match(last.content[0].content, /R1: two lifts/);
});

test('keeps the saveable draft with the fewest problems when the repairs run out', async () => {
  const drafts = [{ v: 1, n: 2 }, { v: 2, n: 1 }, { v: 3, n: 3 }];
  const client = fake(drafts.map((d, i) => reply([submit(d, `t${i}`)])));
  const check = (plan) => ({ ok: false, problems: Array(plan.n).fill('x'), saveable: true });
  const r = await planWithClaude({ client, system: 'S', user: 'U', check });
  assert.equal(r.stop, 'repairs_used');
  assert.equal(r.submits, MAX_SUBMITS);
  assert.deepEqual(r.plan, { v: 2, n: 1 });
});

test('never returns a plan that fails the format', async () => {
  const client = fake([0, 1, 2].map((i) => reply([submit({ v: i }, `t${i}`)])));
  const r = await planWithClaude({ client, system: 'S', user: 'U', check: () => ({ ok: false, problems: ['bad'], saveable: false }) });
  assert.equal(r.stop, 'repairs_used');
  assert.equal(r.plan, null);
});

test('nudges once when Claude answers in text, then gives up', async () => {
  const text = reply([{ type: 'text', text: 'Here is the plan...' }], 'end_turn');
  const client = fake([text, { ...text }]);
  const r = await planWithClaude({ client, system: 'S', user: 'U', check: okCheck });
  assert.equal(r.stop, 'no_submit');
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].messages.at(-1).content, /submit_plan/);
});

test('a nudge that works saves the plan', async () => {
  const client = fake([reply([{ type: 'text', text: 'hm' }], 'end_turn'), reply([submit({ v: 1 })])]);
  const r = await planWithClaude({ client, system: 'S', user: 'U', check: okCheck });
  assert.equal(r.stop, 'saved');
});

test('stops on a refusal or max_tokens', async () => {
  for (const stop of ['refusal', 'max_tokens']) {
    const r = await planWithClaude({ client: fake([reply([], stop)]), system: 'S', user: 'U', check: okCheck });
    assert.equal(r.stop, stop);
    assert.equal(r.plan, null);
  }
});

test('starts no request after the deadline', async () => {
  let t = 0;
  const client = fake([reply([submit({ v: 1 }, 'a')]), reply([submit({ v: 2 }, 'b')])]);
  const check = () => { t = 100; return { ok: false, problems: ['x'], saveable: true }; };
  const r = await planWithClaude({ client, system: 'S', user: 'U', check, deadline: 50, now: () => t });
  assert.equal(r.stop, 'deadline');
  assert.equal(client.calls.length, 1);
  assert.deepEqual(r.plan, { v: 1 });
});

test('a malformed submit gets an error result and does not count', async () => {
  const bad = { type: 'tool_use', id: 'x', name: 'submit_plan', input: { summary: 'no plan' } };
  const client = fake([reply([bad]), reply([submit({ v: 1 })])]);
  const r = await planWithClaude({ client, system: 'S', user: 'U', check: okCheck });
  assert.equal(r.stop, 'saved');
  assert.equal(r.submits, 1);
  assert.match(client.calls[1].messages.at(-1).content[0].content, /needs/);
});
