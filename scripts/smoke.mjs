#!/usr/bin/env node
// Smoke check of a deployed Coach: the loaders on the real data (/api/health), the sign-in page, and with --pages
// the dashboard pages rendered as the owner. Exit code 1 when anything fails. The Deploy workflow runs it on each
// staged build and after each promote (it rolls back on a failure); the deploy check runs it on previews and on a
// schedule.
//
//   HEALTH_TOKEN=… node scripts/smoke.mjs https://coach.paolobernasconi.com --pages [--expect-deployment <id>]
//   HEALTH_TOKEN=… node scripts/smoke.mjs <staged-url> --staged
//
// --expect-deployment first waits (up to 2 minutes) until /api/health reports that Vercel deployment, so the check
// tests the promoted build and not the one before it (exit code 3 if it never does). --staged leaves out the
// migrations check: a staged build is checked before the merge runs its migrations.
// Env: HEALTH_TOKEN (required); VERCEL_BYPASS_SECRET for protected deployment URLs (*.vercel.app).
// A page passes when it answers 200, has its data-smoke marker, and has no data-section-error or data-page-error.

const PAGES = [
  ['/', 'performance'],
  ['/trends', 'trends'],
  ['/plan', 'plan'],
  ['/settings', 'settings'],
  ['/lift', 'lift'],
  ['/lift/weekly', 'lift-weekly'],
  ['/lift/sessions/latest', 'lift-session'],
  ['/plan?week=2026-01-05', 'plan'],
  ['/health', 'health'],
  ['/health/training', 'health-training'],
  ['/health/labs', 'health-labs'],
  ['/health/labs/glucose', 'health-lab'],
  ['/health/day/today', 'health-day'],
  [`/health/day/${new Date(Date.now() - 864e5).toISOString().slice(0, 10)}`, 'health-day'],
  ['/goals', 'goals'],
  ['/activities/latest', 'activity'],
];
const ATTEMPTS = 3; // a cold start or a deploy that is still being aliased gets two more tries
const WAIT_MS = 10_000;

const args = process.argv.slice(2);
const base = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--expect-deployment')?.replace(/\/$/, '');
const withPages = args.includes('--pages');
const expectDeployment = args.includes('--expect-deployment') ? args[args.indexOf('--expect-deployment') + 1] : null;
const healthPath = args.includes('--staged') ? '/api/health?skip=migrations' : '/api/health';
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
      const { status, body } = await get(healthPath, { authorization: `Bearer ${token}` });
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

async function servedDeployment() {
  try {
    // Only the deployment id: the full checks read several MB from the database, and this polls every 5 s.
    const { body } = await get('/api/health?only=deployment', { authorization: `Bearer ${token}` });
    return JSON.parse(body).deployment ?? null;
  } catch {
    return null;
  }
}

if (expectDeployment) {
  const deadline = Date.now() + 2 * 60_000;
  let served = await servedDeployment();
  while (served !== expectDeployment && Date.now() < deadline) {
    console.log(`Waiting for ${base} to serve ${expectDeployment} (now ${served ?? 'unknown'})…`);
    await new Promise((r) => setTimeout(r, 5_000));
    served = await servedDeployment();
  }
  if (served !== expectDeployment) {
    console.error(`${base} still serves ${served ?? 'an unknown deployment'}, not ${expectDeployment}.`);
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
