#!/usr/bin/env node
// Smoke check of a deployed Coach: the loaders on the real data (/api/health), the sign-in page, and with --pages
// the dashboard pages rendered as the owner. Exit code 1 when anything fails. The deploy check runs it after each
// deploy and on a schedule (.github/workflows/deploy-check.yml); it rolls production back on a failure.
//
//   HEALTH_TOKEN=… node scripts/smoke.mjs https://coach.paolobernasconi.com --pages [--expect-commit <sha>]
//
// --expect-commit first waits (up to 6 minutes) until /api/health reports that commit, so the check tests the new
// deploy and not the one before it. If production never serves it, the exit code is 3.
// Env: HEALTH_TOKEN (required); VERCEL_BYPASS_SECRET for protected deployment URLs (*.vercel.app).
// A page passes when it answers 200, has its data-smoke marker, and has no data-section-error or data-page-error.

const PAGES = [
  ['/', 'performance'],
  ['/plan', 'plan'],
  ['/settings', 'settings'],
  ['/lift', 'lift'],
  ['/lift/weekly', 'lift-weekly'],
];
const ATTEMPTS = 3; // a cold start or a deploy that is still being aliased gets two more tries
const WAIT_MS = 10_000;

const args = process.argv.slice(2);
const base = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--expect-commit')?.replace(/\/$/, '');
const withPages = args.includes('--pages');
const expectCommit = args.includes('--expect-commit') ? args[args.indexOf('--expect-commit') + 1] : null;
const token = process.env.HEALTH_TOKEN;
if (!base || !token) {
  console.error('usage: HEALTH_TOKEN=… node scripts/smoke.mjs <base-url> [--pages]');
  process.exit(2);
}
const bypass = process.env.VERCEL_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_SECRET } : {};

async function get(path, headers = {}) {
  const res = await fetch(base + path, { headers: { ...bypass, ...headers }, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  return { status: res.status, body: await res.text() };
}

/** Each check returns null when it passes, or a reason. */
const checks = [
  [
    '/api/health',
    async () => {
      const { status, body } = await get('/api/health', { authorization: `Bearer ${token}` });
      let json = null;
      try {
        json = JSON.parse(body);
      } catch {}
      for (const c of json?.checks ?? []) console.log(`    ${c.ok ? 'ok  ' : 'FAIL'} ${c.name} (${c.ms} ms)${c.error ? `: ${c.error}` : ''}`);
      return status === 200 && json?.ok ? null : `status ${status}${json?.checks ? '' : `: ${body.slice(0, 200)}`}`;
    },
  ],
  ['/sign-in', async () => ((await get('/sign-in')).status === 200 ? null : `status ${(await get('/sign-in')).status}`)],
  ...(withPages
    ? PAGES.map(([path, marker]) => [
        path,
        async () => {
          const { status, body } = await get(path, { 'x-coach-health': token });
          if (status !== 200) return `status ${status}`;
          if (/data-section-error/.test(body)) return `a section failed: ${/data-section-error="([^"]*)"/.exec(body)?.[1]}`;
          if (/data-page-error/.test(body)) return 'the page error boundary rendered';
          if (!body.includes(`data-smoke="${marker}"`)) return `no data-smoke="${marker}" marker (the page did not render)`;
          return null;
        },
      ])
    : []),
];

async function runOnce() {
  const failures = [];
  for (const [name, run] of checks) {
    let reason;
    try {
      reason = await run();
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    console.log(`${reason ? 'FAIL' : 'ok  '} ${name}${reason ? `: ${reason}` : ''}`);
    if (reason) failures.push(`${name}: ${reason}`);
  }
  return failures;
}

async function servedCommit() {
  try {
    const { body } = await get('/api/health', { authorization: `Bearer ${token}` });
    return JSON.parse(body).commit ?? null;
  } catch {
    return null;
  }
}

if (expectCommit) {
  const deadline = Date.now() + 6 * 60_000;
  let served = await servedCommit();
  while (served !== expectCommit && Date.now() < deadline) {
    console.log(`Waiting for ${base} to serve ${expectCommit.slice(0, 7)} (now ${served?.slice(0, 7) ?? 'unknown'})…`);
    await new Promise((r) => setTimeout(r, 15_000));
    served = await servedCommit();
  }
  if (served !== expectCommit) {
    console.error(`${base} still serves ${served ?? 'an unknown commit'}, not ${expectCommit}. Is production pinned by a rollback?`);
    process.exit(3);
  }
}

let failures = [];
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  console.log(`\nSmoke check of ${base}, attempt ${attempt}/${ATTEMPTS}`);
  failures = await runOnce();
  if (failures.length === 0) break;
  if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, WAIT_MS));
}
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
