import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, parseNote } from './note-markdown.mjs';

test('entities are decoded', () => {
  assert.equal(decodeEntities('There&#39;s &amp; &#x27;a&#x27; &lt;b&gt;'), "There's & 'a' <b>");
});

test('headings, lists, paragraphs and bold', () => {
  const blocks = parseNote('Intro line.\nsecond line.\n\n## What it means\n\n- **Calcium:** fine\n- Other\n\nEnd.');
  assert.deepEqual(blocks.map((b) => b.type), ['paragraph', 'heading', 'list', 'paragraph']);
  assert.equal(blocks[0].spans[0].text, 'Intro line. second line.');
  assert.equal(blocks[1].level, 2);
  assert.deepEqual(blocks[2].items[0], [{ text: 'Calcium:', bold: true }, { text: ' fine', bold: false }]);
});

test('markup in a note stays text', () => {
  const [p] = parseNote('<script>x</script>');
  assert.equal(p.spans[0].text, '<script>x</script>');
});
