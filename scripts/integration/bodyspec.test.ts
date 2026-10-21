// The BodySpec sync (src/lib/vitals/bodyspec-api.ts) on a real Postgres, with BodySpec's sign-in server and API
// replaced by a fake fetch: the token refresh, the first sync, a sync with nothing new, a changed result, the
// /health view and a refused refresh token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { loadBodyspecStatus, openToken, sealToken, syncBodyspec } from '@/lib/vitals/bodyspec-api';
import { loadDexa } from '@/lib/vitals/dexa-queries';
import { loadDexaPage } from '@/lib/vitals/dexa-store';
import { REPORT_VERSION } from '@/lib/vitals/dexa.mjs';

const user = 'user_bodyspec';
const region = (fat: number, lean: number) => ({ fat_mass_kg: fat, lean_mass_kg: lean, bone_mass_kg: 0.2, total_mass_kg: fat + lean + 0.2, region_fat_pct: 20, tissue_fat_pct: 21 });

type Result = { id: string; date: string; updated: string; fatPct: number; vat: number; lean: number };
let results: Result[] = [];
let refreshOk = true;
const calls: string[] = [];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const realFetch = globalThis.fetch;
function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = String(input instanceof Request ? input.url : input);
  calls.push(url.replace(/^https:\/\/[^/]+/, ''));
  if (url.endsWith('/protocol/openid-connect/token')) {
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get('grant_type'), 'refresh_token');
    return Promise.resolve(refreshOk ? json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 300 }) : json({ error: 'invalid_grant' }, 400));
  }
  assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer access-2');
  if (url.includes('/api/v1/users/me/results/?')) {
    return Promise.resolve(json({ results: results.map((r) => ({ result_id: r.id, start_time: `${r.date}T08:00:00`, update_time: r.updated, location: { name: 'SF' } })), pagination: { has_more: false } }));
  }
  const m = /\/results\/([^/]+)\/dexa\/([a-z-]+)$/.exec(url);
  const r = results.find((x) => x.id === m?.[1]);
  if (!m || !r) return Promise.resolve(json({ detail: 'Not Found' }, 404));
  const section: Record<string, unknown> = {
    'scan-info': { result_id: r.id, scanner_model: 'GE Lunar iDXA', acquire_time: `${r.date}T08:00:00`, patient_intake: { age_years: 38, height_cm: 180, weight_kg: 84 } },
    composition: {
      result_id: r.id,
      total: { fat_mass_kg: 15, lean_mass_kg: r.lean, bone_mass_kg: 3.4, total_mass_kg: 83, region_fat_pct: r.fatPct, tissue_fat_pct: r.fatPct + 1 },
      regions: { left_arm: region(1, 4), right_arm: region(1, 4.2) },
      android_gynoid_ratio: 1.1,
    },
    'visceral-fat': { result_id: r.id, vat_mass_kg: r.vat, vat_volume_cm3: r.vat * 1000 },
    rmr: { result_id: r.id, estimates: [{ formula: 'x', kcal_per_day: 1850 }] },
  };
  return Promise.resolve(m[2] in section ? json(section[m[2]]) : json({ detail: 'Not Found' }, 404));
}

process.env.BODYSPEC_TOKEN_KEY = 'integration-test-key';

test('the BodySpec sync stores new and changed scans and refreshes the token', async (t) => {
  globalThis.fetch = fakeFetch as typeof fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
  await sql`DELETE FROM bodyspec_connections WHERE user_id = ${user}`;
  await sql`
    INSERT INTO bodyspec_connections (user_id, client_id, redirect_uri, access_token, refresh_token, expires_at, status, connected_at)
    VALUES (${user}, 'client-1', 'https://coach.example/api/auth/bodyspec/callback', ${sealToken('access-1')}, ${sealToken('refresh-1')},
      now() - interval '1 minute', 'ok', now())`;

  results = [
    { id: 'r1', date: '2025-11-02', updated: '2025-11-02T10:00:00', fatPct: 21, vat: 0.9, lean: 62 },
    { id: 'r2', date: '2026-04-10', updated: '2026-04-10T10:00:00', fatPct: 19, vat: 0.7, lean: 63 },
  ];
  const first = await syncBodyspec(user);
  assert.deepEqual(first, { scans: 2, added: 2, updated: 0, newest: '2026-04-10' });
  const [conn] = await sql`SELECT access_token, refresh_token, status, last_success_at FROM bodyspec_connections WHERE user_id = ${user}`;
  assert.ok(!String(conn.refresh_token).includes('refresh-2'), 'the tokens are stored encrypted');
  assert.equal(openToken(conn.access_token), 'access-2');
  assert.equal(openToken(conn.refresh_token), 'refresh-2', 'the rotated refresh token is kept');
  assert.ok(conn.last_success_at);

  calls.length = 0;
  const again = await syncBodyspec(user);
  assert.deepEqual(again, { scans: 2, added: 0, updated: 0, newest: '2026-04-10' });
  assert.equal(calls.filter((c) => c.includes('/dexa/')).length, 0, 'an unchanged result is not fetched again');
  assert.equal(calls.filter((c) => c.endsWith('/token')).length, 0, 'a valid access token is reused');

  results[1] = { ...results[1], updated: '2026-04-11T09:00:00', vat: 0.65 };
  results.push({ id: 'r3', date: '2026-09-20', updated: '2026-09-20T10:00:00', fatPct: 17.5, vat: 0.55, lean: 64 });
  const third = await syncBodyspec(user);
  assert.deepEqual(third, { scans: 3, added: 1, updated: 1, newest: '2026-09-20' });

  const view = await loadDexa(user);
  assert.deepEqual(view.scans.map((s) => s.scanDate), ['2025-11-02', '2026-04-10', '2026-09-20']);
  const vat = view.measures.find((m) => m.key === 'vatMassKg')!;
  assert.equal(vat.value, 0.55);
  assert.ok(Math.abs(vat.sincePrevious! + 0.1) < 1e-9);
  assert.ok(Math.abs(vat.sinceFirst! + 0.35) < 1e-9);
  assert.equal(view.measures.find((m) => m.key === 'armsLeanKg')!.value, 8.2);

  // Each scan has its Markdown report and derived values, and a changed scan rewrote the next one's "change since".
  const reports = await sql`SELECT result_id, report_md, report_version, derived FROM dexa_scans WHERE user_id = ${user} ORDER BY scan_date`;
  assert.ok(reports.every((r) => r.report_version === REPORT_VERSION && String(r.report_md).startsWith('# DEXA scan')));
  assert.match(String(reports[2].report_md), /Change since the scan before \(2026-04-10\)/);
  assert.match(String(reports[2].report_md), /Visceral fat: 0\.65 → 0\.55 kg/);
  assert.equal(reports[0].derived.armsLeanKg, 8.2);
  const page = await loadDexaPage(user);
  assert.equal(page.trends.latest?.scanDate, '2026-09-20');
  assert.equal(page.trends.measures.find((m) => m.key === 'vatKg')!.value, 0.55);

  // A stale report version is rebuilt from raw on the next sync, without fetching the scans again.
  await sql`UPDATE dexa_scans SET report_version = 0, report_md = NULL WHERE user_id = ${user}`;
  calls.length = 0;
  await syncBodyspec(user);
  assert.equal(calls.filter((c) => c.includes('/dexa/')).length, 0);
  const [rebuilt] = await sql`SELECT count(*)::int AS n FROM dexa_scans WHERE user_id = ${user} AND report_version = ${REPORT_VERSION} AND report_md IS NOT NULL`;
  assert.equal(rebuilt.n, 3);

  const status = await loadBodyspecStatus(user);
  assert.equal(status.connected, true);
  assert.equal(status.scans, 3);
  assert.equal(status.newest, '2026-09-20');

  // A refused refresh token marks the connection for a new sign-in.
  await sql`UPDATE bodyspec_connections SET expires_at = now() - interval '1 minute' WHERE user_id = ${user}`;
  refreshOk = false;
  await assert.rejects(syncBodyspec(user), /BodySpec sign-in failed \(400 invalid_grant\)/);
  const failed = await loadBodyspecStatus(user);
  assert.equal(failed.status, 'auth_failed');
  assert.match(failed.lastError ?? '', /invalid_grant/);

  // A token sealed with another key is refused the same way.
  process.env.BODYSPEC_TOKEN_KEY = 'another-key';
  assert.throws(() => openToken(conn.refresh_token), /cannot be read/);
  process.env.BODYSPEC_TOKEN_KEY = 'integration-test-key';

  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
  await sql`DELETE FROM bodyspec_connections WHERE user_id = ${user}`;
});
