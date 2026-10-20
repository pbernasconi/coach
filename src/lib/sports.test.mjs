// design/sports.json is the one source for sport colors and icons. These checks keep the copies in
// globals.css and SportIcon.tsx in step with it. iOS has the same check in SportStyleTests.swift.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const { sports } = JSON.parse(readFileSync(new URL('design/sports.json', root), 'utf8'));
const css = readFileSync(new URL('src/app/globals.css', root), 'utf8');
const icon = readFileSync(new URL('src/components/SportIcon.tsx', root), 'utf8');

function block(selector) {
  const m = css.match(new RegExp(`(^|\\n)${selector.replace('.', '\\.')} \\{([^}]*--sport-[^}]*)\\}`));
  assert.ok(m, `no ${selector} block with sport tokens in globals.css`);
  return Object.fromEntries([...m[2].matchAll(/--sport-([a-z]+):\s*(#[0-9a-f]{6})/g)].map((x) => [x[1], x[2]]));
}

test('globals.css sport tokens match design/sports.json', () => {
  const light = block(':root');
  const dark = block('.dark');
  for (const s of sports) {
    assert.equal(light[s.id], s.light, `light --sport-${s.id}`);
    assert.equal(dark[s.id], s.dark, `dark --sport-${s.id}`);
  }
  assert.equal(Object.keys(light).length, sports.length);
});

test('SportIcon has every lucide icon that design/sports.json names', () => {
  const map = icon.match(/const ICONS[^{]*\{([^}]*)\}/)[1];
  for (const s of sports) assert.match(map, new RegExp(`\\b${s.lucide}\\b`), `${s.id}: ${s.lucide}`);
});
