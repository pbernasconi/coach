// Builds Packages/LiftKit/Sources/LiftCore/Resources/body-map.json from react-native-body-highlighter's male body
// (MIT, see ATTRIBUTION.md). Every path becomes absolute M/L/C/Q/Z commands, one letter per segment, so LiftCore's
// parser stays small. Usage: npm pack react-native-body-highlighter@3.2.0 && tar xzf react-native-body-highlighter-3.2.0.tgz
//   npm i --no-save svgpath@2.6.0 && node build-body-map.cjs package/dist/assets > ../Packages/LiftKit/Sources/LiftCore/Resources/body-map.json
const path = require('path');
const svgpath = require('svgpath');
const dir = path.resolve(process.argv[2]);
const { bodyFront } = require(path.join(dir, 'bodyFront.js'));
const { bodyBack } = require(path.join(dir, 'bodyBack.js'));

const MUSCLES = new Set(['chest', 'deltoids', 'biceps', 'triceps', 'forearm', 'abs', 'obliques', 'quadriceps', 'adductors',
  'calves', 'tibialis', 'trapezius', 'upper-back', 'lower-back', 'gluteal', 'hamstring']);
const RENAME = { 'upper-back': 'upperBack', 'lower-back': 'lowerBack' };
const num = (n) => { const s = (Math.round(n * 10) / 10).toFixed(1); return s.endsWith('.0') ? s.slice(0, -2) : s; };

function convert(d, box) {
  const out = [];
  svgpath(d).abs().unarc().unshort().iterate((seg, _i, x, y) => {
    const c = seg[0];
    const s = c === 'H' ? ['L', seg[1], y] : c === 'V' ? ['L', x, seg[1]] : seg.slice();
    if (!'MLCQZ'.includes(s[0])) throw new Error(`unexpected command ${c}`);
    for (let k = 1; k < s.length; k += 2) {
      box[0] = Math.min(box[0], s[k]); box[1] = Math.min(box[1], s[k + 1]);
      box[2] = Math.max(box[2], s[k]); box[3] = Math.max(box[3], s[k + 1]);
    }
    out.push(s.length > 1 ? `${s[0]} ${s.slice(1).map(num).join(' ')}` : s[0]);
  });
  return out.join(' ');
}

function side(parts) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const out = parts.map((p) => ({
    region: MUSCLES.has(p.slug) ? (RENAME[p.slug] ?? p.slug) : 'outline',
    paths: [...(p.path.left ?? []), ...(p.path.right ?? []), ...(p.path.common ?? [])].map((d) => convert(d, box)),
  }));
  const bounds = { x: +num(box[0]), y: +num(box[1]), width: +num(box[2] - box[0]), height: +num(box[3] - box[1]) };
  return { bounds, parts: out };
}

process.stdout.write(JSON.stringify({
  source: 'https://github.com/HichamELBSI/react-native-body-highlighter (v3.2.0)',
  license: 'MIT, Copyright (c) 2022 ELABBASSI Hicham',
  front: side(bodyFront),
  back: side(bodyBack),
}));
