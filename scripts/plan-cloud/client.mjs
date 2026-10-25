#!/usr/bin/env node
/**
 * The plan job's calls to Coach (POST /api/plan/proposals, Bearer CRON_SECRET). No database access, no packages.
 *
 *   node scripts/plan-cloud/client.mjs claim [proposalId]   # writes plans/request.json, prints id and weekStart for $GITHUB_OUTPUT
 *   node scripts/plan-cloud/client.mjs submit <proposalId> <weekStart>   # sends plans/<weekStart>.json, .summary.md and profile.json
 *   node scripts/plan-cloud/client.mjs fail <proposalId> "<what failed>"
 *   node scripts/plan-cloud/client.mjs server [proposalId]   # hands it to the server planner; prints handled=true|false
 *     (FRESH=true: a new plan for next week, replacing the one waiting)
 *
 * claim without an id (the Sunday run) asks Coach for a new weekly request for next week, with no answers: the agent
 * decides from the data, and Paolo reviews it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [cmd, id, arg] = process.argv.slice(2);
const coach = process.env.COACH_URL ?? 'https://coach.paolobernasconi.com';
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET is not set.');
  process.exit(3);
}

// The agent's own words (AGENT_OUTPUT, a file outside the public log): the end of it goes into a failure, so the
// Plan page says why. The repository is public, so plan.yml never prints it.
function agentTail() {
  const f = process.env.AGENT_OUTPUT;
  if (!f || !existsSync(f)) return '';
  const t = readFileSync(f, 'utf8').trim();
  return t ? ` The agent said: …${t.slice(-300)}` : '';
}

async function post(body) {
  const res = await fetch(`${coach}/api/plan/proposals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Coach: HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

if (cmd === 'server') {
  // The server planner (POST /api/plan/run) plans it when it is on; otherwise this job does, as before.
  const res = await fetch(`${coach}/api/plan/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify({ id: id || null, fresh: process.env.FRESH === 'true' }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  const r = res?.ok ? await res.json().catch(() => ({})) : {};
  console.error(r.handled ? `The server planner has it: ${r.reason ?? r.id}` : `Planning here: ${r.reason ?? `HTTP ${res?.status ?? 'error'}`}`);
  console.log(`handled=${r.handled ? 'true' : 'false'}`);
} else if (cmd === 'claim') {
  const r = await post({ action: 'claim', id: id || null });
  writeFileSync('plans/request.json', JSON.stringify(r.request, null, 2));
  console.log(`id=${r.id}`);
  console.log(`week=${r.request.weekStart}`);
  console.log(`kind=${r.request.kind}`);
} else if (cmd === 'submit') {
  const file = `plans/${arg}.json`;
  if (!existsSync(file)) {
    await post({ action: 'fail', id, error: `The agent wrote no ${file}.${agentTail()}` });
    console.error(`No ${file}.`);
    process.exit(1);
  }
  let plan;
  try {
    plan = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    await post({ action: 'fail', id, error: `${file} is not JSON: ${e.message.slice(0, 200)}` });
    process.exit(1);
  }
  const summaryFile = `plans/${arg}.summary.md`;
  const summary = existsSync(summaryFile) ? readFileSync(summaryFile, 'utf8').slice(0, 6000) : null;
  // What the planner knew, kept with the proposal for the evals (the golden weeks). Not the user block.
  let context = null;
  try {
    context = existsSync('profile.json') ? JSON.parse(readFileSync('profile.json', 'utf8')) : null;
    if (context) delete context.user;
  } catch {
    context = null;
  }
  const r = await post({ action: 'submit', id, plan, summary, context });
  console.log(`Proposal ${id}: ${r.events} events, ${r.tss} TSS planned, ${r.fails ?? 0} rule failures, ${r.warns ?? 0} warnings. Review it on the Plan page.`);
} else if (cmd === 'fail') {
  await post({ action: 'fail', id, error: `${String(arg ?? 'The plan job failed.').slice(0, 180)}${agentTail()}` });
  console.log(`Proposal ${id} marked as failed.`);
} else {
  console.error('Usage: client.mjs claim [id] | submit <id> <weekStart> | fail <id> "<text>"');
  process.exit(1);
}
