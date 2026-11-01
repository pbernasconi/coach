import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAnswer } from './chatState.mjs';

const msg = (id, role, proposal = null) => ({ id, role, proposal });
const card = (id, status = 'open') => ({ id, status });

test('an answer joins the thread on screen', () => {
  const cur = { threadId: 't1', answering: true, messages: [msg('a', 'user'), msg('b', 'assistant')] };
  const next = withAnswer(cur, { threadId: 't1', message: msg('c', 'user'), reply: msg('d', 'assistant') });
  assert.deepEqual(next.messages.map((m) => m.id), ['a', 'b', 'c', 'd']);
  assert.equal(next.answering, false);
});

test('a new change card turns the open ones stale and leaves decided ones alone', () => {
  const cur = { threadId: 't1', answering: false, messages: [msg('a', 'assistant', card('p1')), msg('b', 'assistant', card('p0', 'applied'))] };
  const next = withAnswer(cur, { threadId: 't1', message: msg('c', 'user'), reply: msg('d', 'assistant', card('p2')) });
  assert.deepEqual(next.messages.map((m) => m.proposal?.status ?? null), ['stale', 'applied', null, 'open']);
  // Without a new card nothing changes.
  const plain = withAnswer(cur, { threadId: 't1', message: msg('c', 'user'), reply: msg('d', 'assistant') });
  assert.equal(plain.messages[0].proposal.status, 'open');
});

test('an answer from a new chat (the old one went idle) starts the list over', () => {
  const cur = { threadId: 'old', answering: false, messages: [msg('a', 'user'), msg('b', 'assistant')] };
  const next = withAnswer(cur, { threadId: 'new', message: msg('c', 'user'), reply: msg('d', 'assistant') });
  assert.equal(next.threadId, 'new');
  assert.deepEqual(next.messages.map((m) => m.id), ['c', 'd']);
  // The first message of a fresh chat (no thread yet) is the same case.
  const fresh = withAnswer({ threadId: null, answering: false, messages: [] }, { threadId: 'n', message: msg('c', 'user'), reply: msg('d', 'assistant') });
  assert.deepEqual(fresh.messages.map((m) => m.id), ['c', 'd']);
});
