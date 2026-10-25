#!/usr/bin/env node
/**
 * Checks a plan JSON against the format (proposal.mjs) and Paolo's planning rules (src/lib/plan/rules.mjs) and
 * prints what to fix. The cloud planner runs it before it submits (scripts/plan-cloud/PROMPT.md); /plan can too.
 * It reads profile.json and plans/request.json when they are there. No database, no network.
 *
 *   node scripts/check-plan.mjs plans/2026-11-02.json
 *
 * Exits 0 when nothing fails (warnings are fine), 1 when a rule or the format fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import { checkPlan } from '../src/lib/plan/proposal.mjs';
import { checkProposal, RULES, todayOf } from '../src/lib/plan/rules.mjs';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Usage: node scripts/check-plan.mjs plans/<weekStart>.json');
  process.exit(2);
}
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const plan = read(file);
const context = read('profile.json');
const request = read('plans/request.json');
const weekStart = String(plan?.weekStart ?? '');

const format = checkPlan(plan, weekStart).errors;
const { issues } = checkProposal(plan, { weekStart, request, context, today: request?.kind === 'checkin' ? todayOf(context) : null });
for (const e of format) console.log(`FAIL format: ${e}`);
for (const i of issues) console.log(`${i.level.toUpperCase()} ${i.id} (${RULES[i.id]}): ${i.message}`);
const fails = format.length + issues.filter((i) => i.level === 'fail').length;
console.log(fails ? `${fails} to fix.` : issues.length ? 'No failures; read the warnings.' : 'All rules pass.');
process.exit(fails ? 1 : 0);
