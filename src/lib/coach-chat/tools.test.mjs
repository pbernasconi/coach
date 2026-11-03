import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAT_TOOLS, READ_TOOL_NAMES } from './chat-tools.mjs';
import { cardTool, readTool, serverTool, toolbox } from './tool-registry.mjs';
import { sourcesLine, sourcesOf, webUses } from './web-tools.mjs';

test('every read tool has a runner in tools.ts', () => {
  const src = readFileSync(new URL('./tools.ts', import.meta.url), 'utf8');
  for (const name of READ_TOOL_NAMES) assert.match(src, new RegExp(`\\b${name}:`), `${name} has no runner in tools.ts`);
});

test('the toolbox: kinds, steps, and the definitions in order', () => {
  assert.deepEqual(CHAT_TOOLS.names('server'), ['web_search', 'web_fetch']);
  assert.ok(CHAT_TOOLS.isRead('get_activity'));
  assert.ok(!CHAT_TOOLS.isRead('web_search'));
  assert.ok(!CHAT_TOOLS.isRead('propose_changes'));
  assert.equal(CHAT_TOOLS.stepOf('web_fetch'), 'searching');
  assert.equal(CHAT_TOOLS.stepOf('get_lift_templates'), 'reading');
  assert.equal(CHAT_TOOLS.stepOf('suggest_replies'), null);
  assert.equal(CHAT_TOOLS.stepOf('nope'), null);
  const web = CHAT_TOOLS.definitions().find((d) => d.name === 'web_search');
  assert.equal(web?.type, 'web_search_20260209');
  assert.ok(Number(web?.max_uses) > 0);
});

test('the toolbox refuses two tools with one name, and a tool without a schema', () => {
  const def = { name: 'get_x', description: 'x', input_schema: { type: 'object', properties: {} } };
  assert.throws(() => toolbox([readTool(def), cardTool(def)]), /two chat tools/);
  assert.throws(() => readTool({ name: 'get_y' }), /description/);
  assert.throws(() => readTool({ ...def, name: 'Bad Name' }), /snake_case/);
  assert.throws(() => serverTool({ name: 'web_z' }), /type/);
});

test('sources: citations first, then fetched pages, each once', () => {
  const content = [
    { type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: 'https://acsm.org/stand', content: { title: 'ACSM position stand' } } },
    { type: 'text', text: 'a', citations: [{ url: 'https://pubmed.ncbi.nlm.nih.gov/1', title: 'Rest [intervals]' }, { url: 'https://pubmed.ncbi.nlm.nih.gov/1', title: 'dup' }] },
    { type: 'text', text: 'b', citations: [{ url: 'javascript:alert(1)', title: 'bad' }, { url: 'https://www.example.com/x' }] },
  ];
  const s = sourcesOf(content);
  assert.deepEqual(s.map((x) => x.url), ['https://pubmed.ncbi.nlm.nih.gov/1', 'https://www.example.com/x', 'https://acsm.org/stand']);
  assert.equal(s[1].title, 'example.com');
  assert.equal(sourcesLine(s.slice(0, 1)), 'Sources: [Rest intervals](https://pubmed.ncbi.nlm.nih.gov/1)');
  assert.equal(sourcesLine([]), '');
  assert.deepEqual(webUses({ server_tool_use: { web_search_requests: 3, web_fetch_requests: 1 } }), { searches: 3, fetches: 1 });
  assert.deepEqual(webUses(undefined), { searches: 0, fetches: 0 });
});
