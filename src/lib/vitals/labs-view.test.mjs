// Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandScale, buildIndex, displayText, drawStatus, neighbours, parseContent, valueText } from './labs-view.mjs';
import { bandsFor } from './function-catalog.mjs';

const B = (key, name, status) => ({ key, name, slug: name.toLowerCase(), status });

test('index: sections by position, Function order inside, flat order visits each once', () => {
  const biomarkers = [B('1', 'Alpha', 'in_range'), B('2', 'Beta', 'out_of_range'), B('3', 'Gamma', 'other'), B('4', 'Delta', 'in_range'), B('5', 'Loose', 'in_range')];
  const categories = [
    { key: 'c2', name: 'Zeta', description: null, position: 1, biomarkerKeys: ['4', '2'] },
    { key: 'c1', name: 'Eta', description: 'd', position: 0, biomarkerKeys: ['3', '1', '2', 'missing'] },
    { key: 'c3', name: 'Empty', description: null, position: 2, biomarkerKeys: ['missing'] },
  ];
  const { sections, order, counts } = buildIndex(categories, biomarkers);
  assert.deepEqual(sections.map((s) => [s.name, s.items.map((i) => i.name)]), [
    ['Eta', ['Beta', 'Alpha', 'Gamma']],
    ['Zeta', ['Beta', 'Delta']],
    ['Other results', ['Loose']],
  ]);
  assert.deepEqual(order.map((o) => o.name), ['Beta', 'Alpha', 'Gamma', 'Delta', 'Loose']);
  assert.deepEqual(counts, { all: 5, out_of_range: 1, in_range: 3, other: 1 });
  const n = neighbours(order, 'gamma');
  assert.equal(n.prev.name, 'Alpha');
  assert.equal(n.next.name, 'Delta');
  assert.equal(n.category, 'Eta');
  assert.equal(neighbours(order, 'beta').prev, null);
  assert.equal(neighbours(order, 'loose').next, null);
  assert.equal(neighbours(order, 'nope').index, -1);
});

test('draw status and value text', () => {
  assert.equal(drawStatus('out_of_range', 'in_range'), 'out_of_range');
  assert.equal(drawStatus('optimal', 'out_of_range'), 'in_range');
  assert.equal(drawStatus('in_range', 'other'), 'other');
  assert.equal(drawStatus('unknown', 'in_range'), 'in_range');
  assert.equal(drawStatus('unknown', 'out_of_range'), 'out_of_range');
  assert.equal(displayText('NEGATIVE'), 'Negative');
  assert.equal(displayText('<10'), '<10');
  assert.equal(displayText(''), null);
  assert.equal(valueText(15.1, null, 'g/dL'), '15.1 g/dL');
  assert.equal(valueText(null, 'NEGATIVE', 'mg/dL'), 'Negative');
  assert.equal(valueText(10, '<10', 'IU/mL'), '<10 IU/mL');
  assert.equal(valueText(null, null, 'x'), '-');
  assert.equal(valueText(0.123456, null, null), '0.1235');
});

test('band scale: equal band heights, linear inside, clamped outside', () => {
  const two = bandScale(bandsFor({ min: 10, max: 20, minOp: '>=', maxOp: '<=' }), [15, 21]);
  assert.ok(Math.abs(two.position(10) - 1 / 3) < 1e-9);
  assert.ok(Math.abs(two.position(20) - 2 / 3) < 1e-9);
  assert.ok(Math.abs(two.position(15) - 0.5) < 1e-9);
  assert.ok(two.position(21) > 2 / 3 && two.position(21) < 1);
  assert.equal(two.position(-100), 0);
  assert.equal(two.position(1e6), 1);
  const upper = bandScale(bandsFor({ min: null, max: 200, maxOp: '<' }), [150, 230]);
  assert.equal(upper.edges[0].lo, 0); // "< 200" starts at 0
  assert.ok(Math.abs(upper.position(200) - 0.5) < 1e-9);
  assert.ok(upper.position(230) > 0.5);
  const none = bandScale([], [1, 3]);
  assert.equal(none.position(3), 1);
});

test('content markdown: headings, lists, bold, https links only', () => {
  const blocks = parseContent('**Root causes**\n\nSee [Nutrition 101](https://example.com/n) and [bad](javascript:alert(1)).\n\n- one\n- [two](https://example.com/2)');
  assert.equal(blocks[0].spans[0].bold, true);
  const p = blocks[1].spans;
  assert.deepEqual(p.find((s) => s.href), { text: 'Nutrition 101', bold: false, href: 'https://example.com/n' });
  assert.ok(p.every((s) => !s.href || s.href.startsWith('https://')));
  assert.ok(p.some((s) => s.text.includes('[bad](javascript:')));
  assert.equal(blocks[2].type, 'list');
  assert.equal(blocks[2].items[1][0].href, 'https://example.com/2');
});
