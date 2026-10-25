/**
 * The Past plans page (/plan/history): every week planned in the last 6 months and every plan the cloud coach
 * proposed, checked against Paolo's planning rules (rules.mjs), with his good/bad verdict. Phase 0 of the planner
 * evals: the baseline of how often each rule broke, and his reasons, decide what the evals test first.
 */

import { sql } from '@/db';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { checkProposal, checkRules, RULES, sessionsFromRows } from '@/lib/plan/rules.mjs';
import type { PlanRequest, ProposalChecks, RuleIssue } from '@/lib/plan/proposals';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';

export type Verdict = 'good' | 'bad';
export type HistoryItem = {
  /** 'week:<training_plans.id>' or 'proposal:<plan_proposals.id>' (plan_verdicts.item). */
  key: string;
  kind: 'week' | 'proposal';
  weekStart: string;
  /** The proposal's status (accepted, rejected, proposed), null for a week in Coach. */
  status: string | null;
  title: string | null;
  sessions: number;
  issues: RuleIssue[];
  verdict: Verdict | null;
  note: string | null;
  createdAt: string | null;
};
export type RuleBaseline = { id: string; rule: string; weeks: { fail: number; warn: number }; proposals: { fail: number; warn: number } };
export type PlanHistory = { items: HistoryItem[]; baseline: RuleBaseline[]; weeks: number; proposals: number; rated: number };

type Row = Record<string, unknown>;
const DAYS = 182;

export async function loadPlanHistory(userId: string, today: string): Promise<PlanHistory> {
  const from = addDays(mondayOf(today), -DAYS);
  const to = addDays(mondayOf(today), 7);
  const [plans, activities, proposals, verdicts] = (await Promise.all([
    sql`
      SELECT id, week_start_date, context_data->>'title' AS title, created_at FROM training_plans
      WHERE user_id = ${userId} AND week_start_date BETWEEN ${from} AND ${to}`,
    sql`
      SELECT a.plan_id, a.scheduled_date, a.start_time, a.end_time, a.duration, a.title, a.activity_type, a.workout_type,
             a.lift_template, a.intensity
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND p.week_start_date BETWEEN ${from} AND ${to}`,
    // The plan without its long text (descriptions, steps): the rules need times, types and titles only.
    sql`
      SELECT id, week_start, status, request, checks, created_at,
             plan->'review'->>'headline' AS headline, plan->>'title' AS title,
             CASE WHEN checks IS NULL THEN jsonb_build_object(
               'weekStart', plan->'weekStart', 'title', plan->'title', 'context', plan->'context',
               'completed', plan->'completed',
               'events', (SELECT jsonb_agg(e - 'description' - 'why' - 'steps' - 'workout') FROM jsonb_array_elements(plan->'events') e))
             END AS slim
      FROM plan_proposals
      WHERE user_id = ${userId} AND plan IS NOT NULL AND status IN ('proposed', 'accepted', 'rejected')
        AND created_at > NOW() - make_interval(days => ${DAYS})`,
    sql`SELECT item, verdict, note FROM plan_verdicts WHERE user_id = ${userId}`,
  ])) as Row[][];

  const rated = new Map(verdicts.map((v) => [String(v.item), v]));
  const byPlan = new Map<string, Row[]>();
  for (const a of activities) {
    const k = String(a.plan_id);
    if (!byPlan.has(k)) byPlan.set(k, []);
    byPlan.get(k)!.push({ ...a, scheduled_date: toDay(a.scheduled_date) });
  }
  const verdictOf = (key: string) => {
    const v = rated.get(key);
    return { verdict: (v?.verdict as Verdict) ?? null, note: (v?.note as string) ?? null };
  };

  const items: HistoryItem[] = [];
  for (const p of plans) {
    const weekStart = toDay(p.week_start_date) ?? '';
    const rows = byPlan.get(String(p.id)) ?? [];
    const sessions = sessionsFromRows(rows);
    if (!sessions.length) continue;
    const key = `week:${p.id}`;
    items.push({
      key, kind: 'week', weekStart, status: null, title: (p.title as string) || null, sessions: sessions.length,
      issues: checkRules(sessions, { weekStart }) as RuleIssue[], createdAt: toIso(p.created_at), ...verdictOf(key),
    });
  }
  for (const p of proposals) {
    const weekStart = toDay(p.week_start) ?? '';
    const stored = p.checks as ProposalChecks | null;
    const checks = stored?.issues ? stored : (checkProposal(p.slim, { weekStart, request: p.request as PlanRequest }) as ProposalChecks);
    const key = `proposal:${p.id}`;
    items.push({
      key, kind: 'proposal', weekStart, status: String(p.status), title: (p.headline as string) || (p.title as string) || null,
      sessions: Array.isArray((p.slim as { events?: unknown[] } | null)?.events) ? (p.slim as { events: unknown[] }).events.length : 0,
      issues: checks.issues, createdAt: toIso(p.created_at), ...verdictOf(key),
    });
  }
  items.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || (a.kind === b.kind ? 0 : a.kind === 'week' ? -1 : 1));

  const count = (kind: HistoryItem['kind'], id: string, level: 'fail' | 'warn') =>
    items.filter((i) => i.kind === kind && i.issues.some((x) => x.id === id && x.level === level && !(level === 'warn' && i.issues.some((y) => y.id === id && y.level === 'fail')))).length;
  const baseline = Object.entries(RULES).map(([id, rule]) => ({
    id, rule,
    weeks: { fail: count('week', id, 'fail'), warn: count('week', id, 'warn') },
    proposals: { fail: count('proposal', id, 'fail'), warn: count('proposal', id, 'warn') },
  }));
  return {
    items,
    baseline,
    weeks: items.filter((i) => i.kind === 'week').length,
    proposals: items.filter((i) => i.kind === 'proposal').length,
    rated: items.filter((i) => i.verdict).length,
  };
}

/** Saves (or with verdict null, clears) Paolo's verdict on a past plan. */
export async function saveVerdict(userId: string, item: string, weekStart: string, verdict: Verdict | null, note: string | null) {
  if (!verdict) {
    await sql`DELETE FROM plan_verdicts WHERE user_id = ${userId} AND item = ${item}`;
    return;
  }
  await sql`
    INSERT INTO plan_verdicts (user_id, item, week_start, verdict, note, updated_at)
    VALUES (${userId}, ${item}, ${weekStart}, ${verdict}, ${note}, NOW())
    ON CONFLICT (user_id, item) DO UPDATE SET verdict = EXCLUDED.verdict, note = EXCLUDED.note, updated_at = NOW()`;
}
