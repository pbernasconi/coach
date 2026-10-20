#!/usr/bin/env node
// Page speed of a deployed Coach, as the owner (the x-coach-health header, GET only). For each page:
//   load: the full HTML of a first load (time to first byte, and to the last byte of the streamed page);
//   nav:  the RSC payload a click in the app fetches (header RSC: 1), to the last byte.
// One request per page warms the function; the medians of the next RUNS requests are reported.
//
//   HEALTH_TOKEN=… node scripts/perf.mjs <base-url> [<other-base-url>]
//
// With two URLs it prints both side by side and the change. Env: HEALTH_TOKEN (required); VERCEL_BYPASS_SECRET for
// protected *.vercel.app URLs; RUNS (default 5).

const PAGES = ['/', '/plan', '/plan?month=2026-01', '/lift', '/lift/weekly', '/health', '/health/training', '/health/day/today', '/settings'];
const RUNS = Number(process.env.RUNS ?? 5);
const token = process.env.HEALTH_TOKEN;
const bases = process.argv.slice(2).map((b) => b.replace(/\/$/, ''));
if (!token || bases.length === 0) {
  console.error('usage: HEALTH_TOKEN=… node scripts/perf.mjs <base-url> [<other-base-url>]');
  process.exit(2);
}
const headers = {
  'x-coach-health': token,
  ...(process.env.VERCEL_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_SECRET } : {}),
};

async function time(url, extra = {}) {
  const start = performance.now();
  const res = await fetch(url, { headers: { ...headers, ...extra }, redirect: 'manual' });
  const reader = res.body.getReader();
  let first = null;
  for (;;) {
    const { done } = await reader.read();
    first ??= performance.now() - start;
    if (done) break;
  }
  return { status: res.status, ttfb: first, total: performance.now() - start };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function measure(base) {
  const rows = {};
  for (const page of PAGES) {
    await time(base + page); // warm-up
    const load = [];
    const nav = [];
    for (let i = 0; i < RUNS; i++) {
      load.push(await time(base + page));
      nav.push(await time(base + page, { RSC: '1' }));
    }
    const bad = [...load, ...nav].find((r) => r.status !== 200);
    rows[page] = {
      status: bad?.status ?? 200,
      ttfb: median(load.map((r) => r.ttfb)),
      load: median(load.map((r) => r.total)),
      nav: median(nav.map((r) => r.total)),
    };
  }
  return rows;
}

/** The network floor: a file from Vercel's CDN, and a function that answers without data (401). */
async function floor(base) {
  const cdn = [];
  const fn = [];
  for (let i = 0; i <= RUNS; i++) {
    cdn.push(await time(`${base}/favicon.ico`));
    fn.push(await time(`${base}/api/health`, { authorization: 'Bearer none' }));
  }
  return { cdn: median(cdn.slice(1).map((r) => r.ttfb)), fn: median(fn.slice(1).map((r) => r.ttfb)) };
}

/** Each loader's time on the server (/api/health runs them all at once), on a cold and then a warm call. */
async function loaders(base) {
  const call = async () => {
    const res = await fetch(`${base}/api/health`, { headers: { ...headers, authorization: `Bearer ${token}` } });
    return (await res.json()).checks ?? [];
  };
  const cold = await call();
  const warm = await call();
  return warm.map((c) => `${c.name} ${cold.find((x) => x.name === c.name)?.ms ?? '?'}→${c.ms}`).join(', ');
}

const results = [];
const floors = [];
for (const base of bases) {
  floors.push(await floor(base));
  results.push(await measure(base));
}
const ms = (x) => `${Math.round(x)}`.padStart(6);
const pct = (a, b) => `${Math.round((1 - b / a) * 100)}%`.padStart(5);
console.log(`median of ${RUNS} runs, ms${bases.length > 1 ? ` — A: ${bases[0]}  B: ${bases[1]}` : ` — ${bases[0]}`}`);
floors.forEach((f, i) => console.log(`network floor ${'AB'[i]}: CDN file ${Math.round(f.cdn)} ms, function without data ${Math.round(f.fn)} ms`));
for (const [i, base] of bases.entries()) console.log(`loaders ${'AB'[i]} (ms, first call→second): ${await loaders(base)}`);
for (const page of PAGES) {
  const [a, b] = results.map((r) => r[page]);
  const line = `${page.padEnd(20)} ttfb ${ms(a.ttfb)}  load ${ms(a.load)}  nav ${ms(a.nav)}${a.status !== 200 ? `  (status ${a.status})` : ''}`;
  console.log(
    b
      ? `${line}  |  B ttfb ${ms(b.ttfb)}  load ${ms(b.load)} (${pct(a.load, b.load)})  nav ${ms(b.nav)} (${pct(a.nav, b.nav)})${b.status !== 200 ? `  (status ${b.status})` : ''}`
      : line
  );
}
if (results.length > 1) {
  const sum = (r, k) => PAGES.reduce((n, p) => n + r[p][k], 0);
  for (const k of ['ttfb', 'load', 'nav']) {
    console.log(`all pages ${k}: A ${Math.round(sum(results[0], k))} ms, B ${Math.round(sum(results[1], k))} ms, ${pct(sum(results[0], k), sum(results[1], k))} faster`);
  }
}
