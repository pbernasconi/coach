import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY, MAX_PROPOSALS, chatMessages, chatWithClaude, streamEventToChat } from './chat.mjs';
import { chatContext, chatSystemPrompt } from './prompt.mjs';

const usage = { input_tokens: 1000, output_tokens: 300, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 };
const say = (text) => ({ type: 'text', text });
const propose = (input, id = 't1') => ({ type: 'tool_use', id, name: 'propose_changes', input });
const reply = (content, stop_reason = 'end_turn') => ({ content, stop_reason, usage, model: 'claude-opus-5-5' });

function fake(replies) {
  const calls = [];
  return {
    calls,
    beta: { messages: { stream: (params) => { calls.push(structuredClone(params)); const r = replies.shift(); return { finalMessage: async () => r }; } } },
  };
}

const base = { system: 'S', history: [], context: 'CTX', text: 'Move the lift' };

test('a plain answer has no card', async () => {
  const client = fake([reply([say('Tuesday is free until 13:30.')])]);
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail('no tool call') });
  assert.equal(r.stop, 'answered');
  assert.equal(r.reply, 'Tuesday is free until 13:30.');
  assert.equal(r.proposal, null);
  const p = client.calls[0];
  assert.equal(p.system[0].cache_control.ttl, '1h');
  assert.equal(p.tools[0].name, 'propose_changes');
  assert.deepEqual(p.messages.at(-1).content.map((b) => b.text), ['CTX', '<paolo>\nMove the lift\n</paolo>']);
});

test('a card that passes ends the turn at once', async () => {
  const client = fake([reply([say('The lift goes to Tuesday 09:00.'), propose({ title: 'Lift Tuesday' })], 'tool_use')]);
  const r = await chatWithClaude({ ...base, client, check: (input, attempt) => ({ ok: true, value: { ...input, attempt } }) });
  assert.equal(r.stop, 'proposed');
  assert.deepEqual(r.proposal, { title: 'Lift Tuesday', attempt: 1 });
  assert.equal(r.reply, 'The lift goes to Tuesday 09:00.');
  assert.equal(client.calls.length, 1);
  assert.ok(r.usage.usd > 0);
});

test('problems go back to Claude, and the repaired card is kept', async () => {
  const client = fake([
    reply([say('Moving it.'), propose({ v: 1 }, 'a')], 'tool_use'),
    reply([propose({ v: 2 }, 'b')], 'tool_use'),
  ]);
  const check = (input) => (input.v === 2 ? { ok: true, value: input } : { ok: false, problems: ['R3: heavy lift on a VO2 day'] });
  const r = await chatWithClaude({ ...base, client, check });
  assert.equal(r.stop, 'proposed');
  assert.deepEqual(r.proposal, { v: 2 });
  // Every try is kept for analysis, with what the check said.
  assert.deepEqual(r.attempts, [{ input: { v: 1 }, problems: ['R3: heavy lift on a VO2 day'] }, { input: { v: 2 }, problems: null }]);
  const back = client.calls[1].messages.at(-1).content[0];
  assert.equal(back.is_error, true);
  assert.match(back.content, /R3: heavy lift/);
});

test('after the last try it explains in text and shows no card', async () => {
  const replies = [];
  for (let i = 0; i < MAX_PROPOSALS; i++) replies.push(reply([propose({ v: i }, `t${i}`)], 'tool_use'));
  replies.push(reply([say("I couldn't fit the lift on Tuesday.")]));
  const client = fake(replies);
  const r = await chatWithClaude({ ...base, client, check: () => ({ ok: false, problems: ['nope'] }) });
  assert.equal(r.proposal, null);
  assert.deepEqual(r.problems, ['nope']);
  assert.equal(r.reply, "I couldn't fit the lift on Tuesday.");
  assert.match(client.calls.at(-1).messages.at(-1).content[0].content, /Don't call the tool again/);
});

test('a refusal stops', async () => {
  const r = await chatWithClaude({ ...base, client: fake([reply([], 'refusal')]), check: () => ({ ok: true, value: {} }) });
  assert.equal(r.stop, 'refusal');
  assert.equal(r.reply, '');
});

test('the history alternates, starts with Paolo and is capped', () => {
  const history = [
    { role: 'assistant', text: 'orphan' },
    { role: 'user', text: 'a' },
    { role: 'user', text: 'b' },
    { role: 'assistant', text: 'c' },
  ];
  const m = chatMessages(history, 'CTX', 'd');
  assert.deepEqual(m.map((x) => x.role), ['user', 'assistant', 'user']);
  assert.equal(m[0].content, 'a\n\nb');
  const long = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: String(i) }));
  assert.ok(chatMessages(long, 'CTX', 'x').length <= HISTORY + 1);
  // An unanswered message goes with the new one.
  const open = chatMessages([{ role: 'user', text: 'first' }], 'CTX', 'second');
  assert.equal(open.length, 1);
  assert.deepEqual(open[0].content.map((b) => b.text), ['first', 'CTX', '<paolo>\nsecond\n</paolo>']);
});

test('the system prompt is the chat prompt, then the coaching rules, check-in rules and plan structure', () => {
  const s = chatSystemPrompt();
  const at = ['# Coach chat', '# Coaching rules', '# Check-ins', '# Plan Structure'].map((h) => s.indexOf(h));
  assert.ok(at.every((i) => i >= 0), String(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(s, /propose_changes/);
  assert.equal(s, chatSystemPrompt());
  const c = chatContext({ today: '2026-10-26', time: 'Monday 14:05', timeZone: 'America/Los_Angeles', plan: 'P', profileMd: 'PR' });
  assert.match(c, /<now>\nToday is 2026-10-26, Monday 14:05/);
  assert.match(c, /<plan>\nP\n<\/plan>/);
});

const tool = (name, input, id) => ({ type: 'tool_use', id, name, input });

test('a card and one-tap answers are shown in one request', async () => {
  const client = fake([reply([say('Tomorrow is VO2 B. Morning or evening?'), tool('show', { kind: 'workout', ref: 'v' }, 's1'), tool('suggest_replies', { options: ['Morning', 'Evening', 'Morning'] }, 's2')], 'tool_use')]);
  const r = await chatWithClaude({ ...base, client, check: () => ({ ok: false, problems: [] }) });
  assert.equal(r.stop, 'shown');
  assert.equal(client.calls.length, 1);
  assert.deepEqual(r.cards, [{ kind: 'workout', ref: 'v' }]);
  assert.deepEqual(r.replies, ['Morning', 'Evening']);
  assert.equal(client.calls[0].tools.map((t) => t.name).join(), 'propose_changes,show,suggest_replies,ask_questions');
});

test('a broken card goes back once; a card with a proposal stops at the proposal', async () => {
  const client = fake([
    reply([say('Here.'), tool('show', { kind: 'workout', ref: 'nope' }, 's1')], 'tool_use'),
    reply([tool('show', { kind: 'workout', ref: 'v' }, 's2'), propose({ v: 1 }, 'p1')], 'tool_use'),
  ]);
  const checkCard = (i) => (i.ref === 'v' ? { ok: true, value: i } : { ok: false, problems: ['no workout with id nope'] });
  const r = await chatWithClaude({ ...base, client, checkCard, check: (i) => ({ ok: true, value: i }) });
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].messages.at(-1).content[0].content, /Not shown: no workout with id nope/);
  assert.equal(r.stop, 'proposed');
  assert.deepEqual(r.cards, [{ kind: 'workout', ref: 'v' }]);
});

test('the stream tells the phone each step and the words as they come', async () => {
  const events = [
    { type: 'content_block_start', content_block: { type: 'thinking' } },
    { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Tuesday is free.' } },
    { type: 'content_block_start', content_block: { type: 'text' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'The lift ' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'goes to Tuesday.' } },
    { type: 'content_block_start', content_block: { type: 'tool_use', name: 'propose_changes' } },
  ];
  const calls = [];
  const client = {
    beta: { messages: { stream: (params) => {
      calls.push(params);
      const listeners = [];
      return {
        on: (name, fn) => { assert.equal(name, 'streamEvent'); listeners.push(fn); },
        finalMessage: async () => {
          for (const e of events) for (const fn of listeners) fn(e);
          return reply([say('The lift goes to Tuesday.'), propose({ title: 'Lift Tuesday' })], 'tool_use');
        },
      };
    } } },
  };
  const heard = [];
  let t = 0;
  const r = await chatWithClaude({ ...base, client, now: () => (t += 100), check: (input) => ({ ok: true, value: input }), onEvent: (e) => heard.push(e) });
  assert.deepEqual(heard, [
    { type: 'status', step: 'thinking' },
    { type: 'thinking', text: 'Tuesday is free.' },
    { type: 'status', step: 'writing' },
    { type: 'text', delta: 'The lift ' },
    { type: 'text', delta: 'goes to Tuesday.' },
    { type: 'status', step: 'proposing' },
  ]);
  assert.equal(r.stop, 'proposed');
  assert.ok(r.timing.firstTextMs > r.timing.firstThinkingMs);
  assert.equal(r.timing.turnMs.length, 1);
  // Low effort and a thinking summary, and the new message is marked for the cache (a repair reads it back).
  assert.equal(calls[0].output_config.effort, 'low');
  assert.equal(calls[0].thinking.display, 'summarized');
  assert.deepEqual(calls[0].messages[0].content.at(-1).cache_control, { type: 'ephemeral' });
});

test('a listener that throws never stops the answer', async () => {
  const client = {
    beta: { messages: { stream: () => {
      let fn;
      return {
        on: (_, f) => { fn = f; },
        finalMessage: async () => {
          fn({ type: 'content_block_start', content_block: { type: 'text' } });
          return reply([say('Fine.')]);
        },
      };
    } } },
  };
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail(), onEvent: () => { throw new Error('hung up'); } });
  assert.equal(r.reply, 'Fine.');
});

test('a second text block is set apart from the first', () => {
  const out = [];
  const seen = { text: false };
  for (const e of [
    { type: 'content_block_start', content_block: { type: 'text' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'One.' } },
    { type: 'content_block_start', content_block: { type: 'tool_use', name: 'show' } },
    { type: 'content_block_start', content_block: { type: 'text' } },
  ]) streamEventToChat(e, (x) => out.push(x), seen);
  assert.deepEqual(out.filter((x) => x.type === 'text').map((x) => x.delta), ['One.', '\n\n']);
  assert.ok(out.some((x) => x.type === 'status' && x.step === 'card'));
});

test('question cards end the turn, and the thinking summary comes back as the thought', async () => {
  const ask = {
    type: 'tool_use', id: 'q', name: 'ask_questions',
    input: { questions: [{ title: 'Which days are you away?', kind: 'multi', options: ['Mon', 'Tue', 'Wed'] }] },
  };
  const client = fake([reply([{ type: 'thinking', thinking: 'He travels; I need the days.' }, say('Two quick ones.'), ask], 'tool_use')]);
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail('no proposal') });
  assert.equal(client.calls.length, 1);
  assert.equal(r.stop, 'shown');
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].id, 'q1');
  assert.equal(r.thought, 'He travels; I need the days.');
});

test('a reply without thinking has an empty thought', async () => {
  const r = await chatWithClaude({ ...base, client: fake([reply([say('Fine.')])]), check: () => assert.fail('no tool call') });
  assert.equal(r.thought, '');
  assert.deepEqual(r.questions, []);
});
