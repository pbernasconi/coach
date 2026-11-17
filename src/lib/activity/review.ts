/**
 * The coach's review of a finished workout: plan versus done step by step (adherence.mjs) and Claude's words on it
 * (review.mjs), stored per activity in activity_reviews. The pages read the stored review; when it is missing or out of
 * date they ask for a new one (POST /api/activities/[id]/review on the web, PUT /api/app/activities/:id/review on the
 * phone), and the workouts cron makes the ones of the last two days ahead of a view.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { monthSpend, recordAiUsage } from '@/lib/ai-usage/store';
import { REVIEW_FEATURES, usageOf } from '@/lib/ai-usage/usage.mjs';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { loadFeedback } from '@/lib/plan/feedback';
import { PROMPT_VERSION, REVIEW_PROMPT, SOURCES } from '@/lib/planner/prompt-sources.generated.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';
import { loadThresholds } from '@/lib/strava-sync/thresholds.mjs';
import { thresholdValues } from '@/lib/strava-sync/tss.mjs';
import { ANCHORS } from '@/lib/workouts/steps.mjs';
import { analyzeAdherence } from './adherence.mjs';
import { loadActivity, loadActivityContext, type ActivityContext, type ActivityView } from './queries';
import { parseReview, REVIEW_EFFORT, REVIEW_MODEL, REVIEW_MONTHLY_CAP_USD, REVIEW_SCHEMA, reviewInput, reviewKey } from './review.mjs';
import { reviewView } from './review-view.mjs';

type Row = Record<string, unknown>;
type Analysis = NonNullable<ReturnType<typeof analyzeAdherence>>;
type Review = { headline: string; rating: string; trainingEffect: string; wentWell: string[]; toImprove: string[]; nextTime: string[] };
type Stored = { key: string; status: string; review: Review | null; error: string | null; updatedAt: string | null };

/** A failed review is tried again after this long (a page view asks again only then). */
const RETRY_AFTER_MS = 30 * 60_000;

/** The basis of a review: the analysis and what it was made from. Null for an activity with no structured plan. */
async function basisOf(userId: string, v: ActivityView, ctx: ActivityContext | null) {
  const planned = ctx?.planned;
  const steps = planned?.steps as StructuredWorkout | null | undefined;
  if (!planned || !steps?.steps?.length || (steps.sport !== 'run' && steps.sport !== 'ride')) return null;
  if (v.layout === 'basic' || !(v.series || v.laps.length)) return null;
  const [thresholds, feedback] = await Promise.all([
    loadThresholds(sql, userId).then(thresholdValues).catch(() => null),
    loadFeedback(userId, [`strava:${v.stravaId}`], planned.id).catch(() => null),
  ]);
  const anchors = { lthr: ANCHORS.lthr, ftp: ANCHORS.ftp, maxHr: ANCHORS.maxHr, paceS: thresholds?.runPaceS ?? null };
  const analysis = analyzeAdherence({ workout: steps as never, sport: steps.sport, series: v.series, laps: v.laps, anchors }) as Analysis | null;
  if (!analysis) return null;
  const fb = feedback ? { feel: feedback.feel, rpe: feedback.rpe, comment: feedback.comment } : null;
  const key = reviewKey({ promptVersion: PROMPT_VERSION, plannedId: planned.id, steps, analysis, feedback: fb });
  return { planned: { ...planned, steps }, analysis, feedback: fb, key, thresholds, anchors };
}

async function readStored(userId: string, stravaId: string): Promise<Stored | null> {
  const [r] = (await sql`
    SELECT key, status, review, error, updated_at FROM activity_reviews WHERE user_id = ${userId} AND strava_activity_id = ${stravaId}`) as Row[];
  if (!r) return null;
  return { key: String(r.key), status: String(r.status), review: (r.review as Review | null) ?? null, error: (r.error as string) ?? null, updatedAt: toIso(r.updated_at) };
}

/** What the review section shows now, without calling Claude. */
function stateOf(basis: { key: string }, stored: Stored | null, capped: boolean) {
  if (stored?.status === 'ok' && stored.review) {
    // A stale review still shows until the new one is in.
    return { status: stored.key === basis.key ? ('ready' as const) : ('pending' as const), review: stored.review };
  }
  if (stored?.status === 'failed' && stored.key === basis.key && stored.updatedAt && Date.now() - Date.parse(stored.updatedAt) < RETRY_AFTER_MS) {
    return { status: 'failed' as const, review: null, note: "Coach couldn't write the review. It tries again in a while." };
  }
  if (capped) return { status: 'off' as const, review: null, note: "This month's budget for reviews is used up." };
  return { status: 'pending' as const, review: null };
}

/**
 * The review section of an activity page: the analysis with the stored review, or null for an activity with no
 * structured plan. `status` pending tells the page to ask for the review (generateReview).
 */
export async function loadReviewSection(userId: string, v: ActivityView, ctx: ActivityContext | null) {
  const basis = await basisOf(userId, v, ctx);
  if (!basis) return null;
  const [stored, spent] = await Promise.all([readStored(userId, v.stravaId), monthSpend(userId, REVIEW_FEATURES)]);
  const state = stateOf(basis, stored, spent >= REVIEW_MONTHLY_CAP_USD);
  return reviewView(basis.analysis, state);
}

/** The last reviewed sessions of the same workout bank, before this one. */
async function historyOf(userId: string, bank: string | null, stravaId: string) {
  if (!bank) return [];
  const rows = (await sql`
    SELECT r.analysis, r.review, a.start_date_local AS day, a.name
      FROM activity_reviews r
      JOIN strava_activities a ON a.user_id = r.user_id AND a.strava_activity_id = r.strava_activity_id
     WHERE r.user_id = ${userId} AND r.bank = ${bank} AND r.status = 'ok' AND r.strava_activity_id <> ${stravaId}
     ORDER BY a.start_date_local DESC LIMIT 3`) as Row[];
  return rows.map((r) => {
    const a = r.analysis as Analysis | null;
    const rv = r.review as Review | null;
    return {
      day: toDay(r.day) ?? String(r.day ?? '').slice(0, 10),
      title: a?.workout?.name ?? String(r.name ?? ''),
      score: a?.score ?? null,
      sets: a?.sets ?? [],
      headline: rv?.headline ?? null,
      nextTime: rv?.nextTime ?? [],
    };
  });
}

/** The next planned session of the same bank after `day`. */
async function nextOf(userId: string, bank: string | null, day: string) {
  if (!bank) return null;
  const [r] = (await sql`
    SELECT a.scheduled_date, a.title, a.steps FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
     WHERE p.user_id = ${userId} AND a.steps ->> 'bank' = ${bank} AND a.scheduled_date > ${day}::date AND a.status <> 'skipped'
     ORDER BY a.scheduled_date LIMIT 1`) as Row[];
  return r ? { date: toDay(r.scheduled_date) ?? '', title: String(r.title), steps: r.steps ?? null } : null;
}

async function save(userId: string, v: ActivityView, basis: NonNullable<Awaited<ReturnType<typeof basisOf>>>, fields: { status: 'ok' | 'failed'; review: Review | null; error: string | null; costUsd: number }) {
  const bank = (basis.planned.steps as { bank?: string }).bank ?? null;
  await sql`
    INSERT INTO activity_reviews (id, user_id, strava_activity_id, plan_activity_id, bank, key, status, error, analysis, review, model, cost_usd)
    VALUES (${createId()}, ${userId}, ${v.stravaId}, ${basis.planned.id}, ${bank}, ${basis.key}, ${fields.status}, ${fields.error},
            ${JSON.stringify(basis.analysis)}::jsonb, ${fields.review ? JSON.stringify(fields.review) : null}::jsonb, ${REVIEW_MODEL}, ${fields.costUsd})
    ON CONFLICT (user_id, strava_activity_id) DO UPDATE SET
      plan_activity_id = EXCLUDED.plan_activity_id, bank = EXCLUDED.bank, key = EXCLUDED.key, status = EXCLUDED.status,
      error = EXCLUDED.error, analysis = EXCLUDED.analysis,
      -- A failed retry keeps the last good review on the page.
      review = COALESCE(EXCLUDED.review, activity_reviews.review),
      model = EXCLUDED.model, cost_usd = activity_reviews.cost_usd + EXCLUDED.cost_usd, updated_at = NOW()`;
}

/**
 * Makes the review of one activity (a Strava id or row id) when it is missing or out of date, and returns the section
 * as loadReviewSection does. Null when the activity has no structured plan or does not exist.
 */
export async function generateReview(userId: string, id: string, today: string) {
  const v = await loadActivity(userId, id);
  if (!v) return null;
  const ctx = await loadActivityContext(userId, v, today).catch(() => null);
  const basis = await basisOf(userId, v, ctx);
  if (!basis) return null;
  const stored = await readStored(userId, v.stravaId);
  if (stored?.status === 'ok' && stored.key === basis.key && stored.review) return reviewView(basis.analysis, { status: 'ready', review: stored.review });
  if ((await monthSpend(userId, REVIEW_FEATURES)) >= REVIEW_MONTHLY_CAP_USD) {
    return reviewView(basis.analysis, stateOf(basis, stored, true));
  }

  const bank = (basis.planned.steps as { bank?: string }).bank ?? null;
  const [history, next] = await Promise.all([
    historyOf(userId, bank, v.stravaId).catch(() => []),
    nextOf(userId, bank, v.day).catch(() => null),
  ]);
  const text = reviewInput({
    activity: v,
    planned: basis.planned as never,
    analysis: basis.analysis,
    feedback: basis.feedback,
    anchors: { ...basis.anchors, restingHr: basis.thresholds?.restingHr ?? null },
    load: ctx?.load ?? null,
    garmin: ctx?.garmin ?? null,
    history,
    next,
  });

  const started = Date.now();
  const client = new Anthropic({ timeout: 110_000, maxRetries: 1 });
  try {
    const res = await client.messages.create({
      model: REVIEW_MODEL,
      max_tokens: 16000,
      system: [{ type: 'text', text: `${REVIEW_PROMPT}\n\n---\n\n${SOURCES['plan-structure.md']}`, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: text }],
      output_config: { effort: REVIEW_EFFORT, format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
    } as never) as unknown as Anthropic.Message;
    const usage = usageOf(res.usage, res.model ?? REVIEW_MODEL);
    const answer = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
    const parsed = res.stop_reason === 'refusal' ? { error: 'Claude declined' } : parseReview(answer);
    const ok = 'review' in parsed;
    await recordAiUsage(userId, {
      feature: 'activity_review', model: res.model ?? REVIEW_MODEL, effort: REVIEW_EFFORT, usage, durationMs: Date.now() - started, ok, refId: v.stravaId,
    });
    if (!ok) {
      await save(userId, v, basis, { status: 'failed', review: null, error: parsed.error, costUsd: usage.usd });
      return reviewView(basis.analysis, stateOf(basis, { key: basis.key, status: 'failed', review: stored?.review ?? null, error: parsed.error, updatedAt: new Date().toISOString() }, false));
    }
    await save(userId, v, basis, { status: 'ok', review: parsed.review as Review, error: null, costUsd: usage.usd });
    return reviewView(basis.analysis, { status: 'ready', review: parsed.review });
  } catch (error) {
    const why = error instanceof Anthropic.APIError ? `Claude API error ${error.status ?? ''}`.trim() : error instanceof Error ? error.message : 'unknown error';
    console.error('Workout review failed:', why);
    await recordAiUsage(userId, { feature: 'activity_review', model: REVIEW_MODEL, effort: REVIEW_EFFORT, durationMs: Date.now() - started, ok: false, refId: v.stravaId });
    await save(userId, v, basis, { status: 'failed', review: null, error: why.slice(0, 300), costUsd: 0 }).catch(() => {});
    const failed = stateOf(basis, { key: basis.key, status: 'failed', review: null, error: why, updatedAt: new Date().toISOString() }, false);
    return reviewView(basis.analysis, stored?.review ? { status: 'ready', review: stored.review } : failed);
  }
}

/**
 * Reviews the planned runs and rides of the last two days that have none yet (the workouts cron), at most `limit`, so
 * a page view finds them ready. Returns how many it made.
 */
export async function reviewRecent(userId: string, today: string, limit = 2) {
  const rows = (await sql`
    SELECT a.strava_activity_id FROM strava_activities a
     WHERE a.user_id = ${userId} AND a.start_date_local >= ${today}::date - 2
       AND (a.sport_type ILIKE '%run%' OR a.sport_type ILIKE '%ride%')
       AND NOT EXISTS (SELECT 1 FROM activity_reviews r WHERE r.user_id = a.user_id AND r.strava_activity_id = a.strava_activity_id)
     ORDER BY a.start_date DESC LIMIT 6`) as Row[];
  let made = 0;
  for (const r of rows) {
    if (made >= limit) break;
    const out = await generateReview(userId, String(r.strava_activity_id), today).catch((e) => {
      console.error('Workout review (cron) failed:', e instanceof Error ? e.message : e);
      return null;
    });
    if (out?.ai.status === 'ready') made++;
  }
  return made;
}
