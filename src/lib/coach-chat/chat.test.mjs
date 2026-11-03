import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY, MAX_PROPOSALS, chatMessages, chatWithClaude, streamEventToChat } from './chat.mjs';
import { chatContext, chatSystemPrompt } from './prompt.mjs';
import { costOf } from '../planner/cost.mjs';

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

test('a card that passes is followed by the words, in one more request', async () => {
  const client = fake([
    reply([say('Let me move it.'), propose({ title: 'Lift Tuesday' })], 'tool_use'),
    reply([say('The lift goes to Tuesday 09:00.')]),
  ]);
  const r = await chatWithClaude({ ...base, client, check: (input, attempt) => ({ ok: true, value: { ...input, attempt } }) });
  assert.equal(r.stop, 'proposed');
  assert.deepEqual(r.proposal, { title: 'Lift Tuesday', attempt: 1 });
  // Text before the tool call is a working note, not the reply.
  assert.equal(r.reply, 'The lift goes to Tuesday 09:00.');
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].messages.at(-1).content[0].content, /write your reply/);
  assert.ok(r.usage.usd > 0);
});

test('problems go back to Claude, and the repaired card is kept', async () => {
  const client = fake([
    reply([say('Moving it.'), propose({ v: 1 }, 'a')], 'tool_use'),
    reply([propose({ v: 2 }, 'b')], 'tool_use'),
    reply([say('Tuesday 09:00 it is.')]),
  ]);
  const check = (input) => (input.v === 2 ? { ok: true, value: input } : { ok: false, problems: ['R3: heavy lift on a VO2 day'] });
  const r = await chatWithClaude({ ...base, client, check });
  assert.equal(r.stop, 'proposed');
  assert.deepEqual(r.proposal, { v: 2 });
  assert.equal(r.reply, 'Tuesday 09:00 it is.');
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
  const client = fake([reply([say('Tomorrow is VO2 B. Morning or evening?'), tool('show', { kind: 'workout', ref: 'v' }, 's1'), tool('suggest_replies', { options: ['Morning', 'Evening', 'Morning'] }, 's2')], 'tool_use'),
    reply([say('Tomorrow is VO2 B. Morning or evening?')])]);
  const r = await chatWithClaude({ ...base, client, check: () => ({ ok: false, problems: [] }) });
  assert.equal(r.stop, 'shown');
  assert.equal(r.reply, 'Tomorrow is VO2 B. Morning or evening?');
  assert.equal(client.calls.length, 2);
  assert.deepEqual(r.cards, [{ kind: 'workout', ref: 'v' }]);
  assert.deepEqual(r.replies, ['Morning', 'Evening']);
  assert.equal(
    client.calls[0].tools.map((t) => t.name).join(),
    'propose_changes,show,suggest_replies,ask_questions,get_activity,find_activities,get_bests,get_load,get_lift_templates,get_exercise_history,web_search,web_fetch',
  );
});

test('a broken card goes back once; a card with a proposal stops at the proposal', async () => {
  const client = fake([
    reply([say('Here.'), tool('show', { kind: 'workout', ref: 'nope' }, 's1')], 'tool_use'),
    reply([tool('show', { kind: 'workout', ref: 'v' }, 's2'), propose({ v: 1 }, 'p1')], 'tool_use'),
    reply([say('Here it is.')]),
  ]);
  const checkCard = (i) => (i.ref === 'v' ? { ok: true, value: i } : { ok: false, problems: ['no workout with id nope'] });
  const r = await chatWithClaude({ ...base, client, checkCard, check: (i) => ({ ok: true, value: i }) });
  assert.equal(client.calls.length, 3);
  assert.match(client.calls[1].messages.at(-1).content[0].content, /Not shown: no workout with id nope/);
  assert.equal(r.reply, 'Here it is.');
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
          if (calls.length > 1) return reply([say('The lift goes to Tuesday.')]);
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
  assert.equal(r.reply, 'The lift goes to Tuesday.');
  assert.equal(r.timing.turnMs.length, 2);
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
  const client = fake([reply([{ type: 'thinking', thinking: 'He travels; I need the days.' }, say('Two quick ones.'), ask], 'tool_use'), reply([say('Two quick ones.')])]);
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail('no proposal') });
  assert.equal(client.calls.length, 2);
  assert.equal(r.reply, 'Two quick ones.');
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

test('read tools: Claude reads an activity, then answers with it', async () => {
  const read = (id, name, input) => ({ type: 'tool_use', id, name, input });
  const client = fake([
    reply([read('r1', 'get_activity', { ref: '208' }), read('r2', 'get_bests', {})], 'tool_use'),
    reply([say('Keep it as a 5k benchmark: the last 5 km took 22:48.')]),
  ]);
  const seen = [];
  const events = [];
  const r = await chatWithClaude({
    ...base, client, check: () => assert.fail('no proposal'),
    readData: async (name, input) => { seen.push([name, input]); return { ok: true, text: `${name} data` }; },
    onEvent: (e) => events.push(e),
  });
  assert.equal(r.stop, 'answered');
  assert.equal(r.turns, 2);
  assert.deepEqual(seen, [['get_activity', { ref: '208' }], ['get_bests', {}]]);
  assert.deepEqual(r.reads.map((x) => [x.name, x.ok]), [['get_activity', true], ['get_bests', true]]);
  const results = client.calls[1].messages.at(-1).content;
  assert.deepEqual(results.map((b) => [b.tool_use_id, b.content, b.is_error]), [['r1', 'get_activity data', undefined], ['r2', 'get_bests data', undefined]]);
  assert.ok(client.calls[0].tools.some((t) => t.name === 'get_activity'));
});

test('read tools: without a reader, or a failed read, Claude gets an error and still answers', async () => {
  const client = fake([
    reply([{ type: 'tool_use', id: 'r1', name: 'get_load', input: {} }], 'tool_use'),
    reply([say('I could not read your load.')]),
  ]);
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail('no proposal') });
  assert.equal(r.stop, 'answered');
  assert.equal(client.calls[1].messages.at(-1).content[0].is_error, true);

  const client2 = fake([
    reply([{ type: 'tool_use', id: 'r1', name: 'get_load', input: {} }], 'tool_use'),
    reply([say('ok')]),
  ]);
  const r2 = await chatWithClaude({ ...base, client: client2, check: () => assert.fail(), readData: async () => { throw new Error('db down'); } });
  assert.equal(r2.reads[0].ok, false);
  assert.match(client2.calls[1].messages.at(-1).content[0].content, /db down/);
});

test('a read tool shows the reading step', () => {
  const out = [];
  streamEventToChat({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'get_activity' } }, (e) => out.push(e), { text: false });
  assert.deepEqual(out, [{ type: 'status', step: 'reading' }]);
});

test('the web: a search pauses, goes on, and the cited answer is one paragraph with its sources', async () => {
  const search = { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: 'rest between sets RDL' } };
  const results = { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [{ type: 'web_search_result', url: 'https://pubmed.ncbi.nlm.nih.gov/1', title: 'Rest intervals' }] };
  const cited = (text) => ({ type: 'text', text, citations: [{ type: 'web_search_result_location', url: 'https://pubmed.ncbi.nlm.nih.gov/1', title: 'Rest intervals', cited_text: 'x' }] });
  const webUsage = { ...usage, server_tool_use: { web_search_requests: 2 } };
  const client = fake([
    { content: [search, results], stop_reason: 'pause_turn', usage: webUsage, model: 'claude-sonnet-5-5' },
    { content: [say('Yes. '), cited('Longer rests of about 3 min gave more strength'), say(' than 1 min.')], stop_reason: 'end_turn', usage, model: 'claude-sonnet-5-5' },
  ]);
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail() });
  assert.equal(r.stop, 'answered');
  assert.equal(client.calls.length, 2);
  // The paused message goes back as it was, with no new message from Paolo after it.
  assert.equal(client.calls[1].messages.at(-1).role, 'assistant');
  assert.deepEqual(client.calls[1].messages.at(-1).content, [search, results]);
  assert.equal(r.reply, 'Yes. Longer rests of about 3 min gave more strength than 1 min.\n\nSources: [Rest intervals](https://pubmed.ncbi.nlm.nih.gov/1)');
  assert.deepEqual(r.web, { searches: 2, fetches: 0, sources: [{ url: 'https://pubmed.ncbi.nlm.nih.gov/1', title: 'Rest intervals' }] });
  // Two searches cost $0.02 on top of the tokens.
  assert.ok(Math.abs(r.usage.usd - (2 * costOf(usage, 'claude-sonnet-5-5') + 0.02)) < 1e-9);
});

test('the stream: a search shows the searching step, and cited text runs on without a break', () => {
  const out = [];
  const seen = { text: false };
  for (const e of [
    { type: 'message_start' },
    { type: 'content_block_start', content_block: { type: 'server_tool_use', name: 'web_search' } },
    { type: 'content_block_start', content_block: { type: 'text' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Yes, ' } },
    { type: 'content_block_start', content_block: { type: 'text' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'three minutes.' } },
  ]) streamEventToChat(e, (x) => out.push(x), seen);
  assert.deepEqual(out.filter((x) => x.type === 'text').map((x) => x.delta), ['Yes, ', 'three minutes.']);
  assert.deepEqual(out.filter((x) => x.type === 'status').map((x) => x.step), ['searching', 'writing']);
});

test('a Lift read tool goes to the reader like the others', async () => {
  const client = fake([
    reply([tool('get_lift_templates', {}, 'r1')], 'tool_use'),
    reply([say('Heavy barbell has 2 sets of RDLs at 2:00 rest.')]),
  ]);
  const asked = [];
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail(), readData: async (name) => { asked.push(name); return { ok: true, text: '## Heavy barbell' }; } });
  assert.deepEqual(asked, ['get_lift_templates']);
  assert.equal(r.reads[0].name, 'get_lift_templates');
  assert.equal(r.stop, 'answered');
});

test('the web: a note before a search is not the reply, and an uncited answer still names where it looked', async () => {
  const search = { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: 'RDL rest' } };
  const results = { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [
    { type: 'web_search_result', url: 'https://pubmed.ncbi.nlm.nih.gov/2', title: 'Rest and strength' },
    { type: 'web_search_result', url: 'https://www.nsca.com/x', title: 'NSCA' },
  ] };
  const webUsage = { ...usage, server_tool_use: { web_search_requests: 1 } };
  const client = fake([
    { content: [say('Not useful; one more search.'), search, results, say('Three minutes is right for heavy RDLs.')], stop_reason: 'end_turn', usage: webUsage, model: 'claude-sonnet-5-5' },
  ]);
  const r = await chatWithClaude({ ...base, client, check: () => assert.fail() });
  assert.equal(r.reply, 'Three minutes is right for heavy RDLs.\n\nSources: [Rest and strength](https://pubmed.ncbi.nlm.nih.gov/2), [NSCA](https://www.nsca.com/x)');
});

test('with no words after the cards, the last note is the reply', async () => {
  let t = 0;
  const client = fake([reply([say('Moving the lift to Tuesday.'), propose({ v: 1 })], 'tool_use')]);
  // The deadline passes during the first request, so no words request is made.
  const r = await chatWithClaude({ ...base, client, deadline: 250, now: () => (t += 100), check: (i) => ({ ok: true, value: i }) });
  assert.equal(client.calls.length, 1);
  assert.equal(r.stop, 'proposed');
  assert.equal(r.reply, 'Moving the lift to Tuesday.');
});
