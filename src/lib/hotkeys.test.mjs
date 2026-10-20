import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findShortcut, ignoreKey, NAV_KEYS } from './hotkeys.mjs';

test('ignoreKey: modifiers, typing, repeats and open dialogs never run a shortcut', () => {
  const div = { tagName: 'DIV' };
  assert.equal(ignoreKey({ key: 't' }, div, false), false);
  assert.equal(ignoreKey({ key: 't', metaKey: true }, div, false), true);
  assert.equal(ignoreKey({ key: 't', ctrlKey: true }, div, false), true);
  assert.equal(ignoreKey({ key: 't' }, { tagName: 'input' }, false), true);
  assert.equal(ignoreKey({ key: 't' }, { tagName: 'TEXTAREA' }, false), true);
  assert.equal(ignoreKey({ key: 't' }, { tagName: 'DIV', isContentEditable: true }, false), true);
  assert.equal(ignoreKey({ key: 't', repeat: true }, div, false), true);
  assert.equal(ignoreKey({ key: 't' }, div, true), true);
  assert.equal(ignoreKey({ key: 't' }, null, false), false);
});

test('findShortcut: the newest page registration wins, then the globals; letters in any case', () => {
  const globals = [{ key: 't', id: 'global-today' }, { key: '?', id: 'help' }];
  const pages = [[{ key: 'j', id: 'old-j' }], [{ key: 't', id: 'plan-today' }, { key: 'j', id: 'new-j' }]];
  assert.equal(findShortcut('t', pages, globals).id, 'plan-today');
  assert.equal(findShortcut('T', pages, globals).id, 'plan-today');
  assert.equal(findShortcut('j', pages, globals).id, 'new-j');
  assert.equal(findShortcut('?', [], globals).id, 'help');
  assert.equal(findShortcut('x', pages, globals), null);
  assert.equal(findShortcut('ArrowLeft', [[{ key: 'ArrowLeft', id: 'a' }]], []).id, 'a');
});

test('NAV_KEYS follow the nav order', () => {
  assert.deepEqual(NAV_KEYS.map((n) => n.key), ['1', '2', '3', '4', '5']);
});
