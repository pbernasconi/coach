/**
 * Weekly planning for the Lift iPhone app (lift/APP-API.md, "Weekly planning"): the web's /plan/week screen as JSON,
 * and its actions. Authenticated by the LIFT_SYNC_TOKEN bearer token, as the other /api/app routes.
 *
 *   GET  /api/app/plan/week?week=YYYY-MM-DD&tz=…   the week (default next week): draft, calendar, last week, shape
 *   PUT  /api/app/plan/week?tz=…  { action, … }    draft | revise | undo | edit | accept → the week as GET, or
 *        { error } (400 bad input, 409 the draft cannot take it)
 */

import { appRoute, appWrite } from '@/lib/app-api/route';
import { plannerApp } from '@/lib/plan/planner-app.mjs';
import { acceptDraft, draftWeek, editDraftSession, reviseDraft, undoDraft, type EditOp } from '@/lib/plan/planner-ops';
import { loadPlannerWeek } from '@/lib/plan/planner-week';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Coach drafts in the background of a draft or revise request, up to 5 minutes.
export const maxDuration = 300;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const weekOf = (week: string | null | undefined, today: string) =>
  week && DAY.test(week) ? mondayOf(week) : addDays(mondayOf(today), 7);

export async function GET(request: Request) {
  const week = new URL(request.url).searchParams.get('week');
  const invalid = week && !DAY.test(week) ? 'week must be YYYY-MM-DD' : null;
  return appRoute(request, 'planning screen', async ({ userId, today }) => plannerApp(await loadPlannerWeek(userId, weekOf(week, today))), invalid);
}

type Body = {
  action?: string; weekStart?: string; proposalId?: string; answers?: Record<string, unknown>; note?: string; op?: EditOp;
};

export async function PUT(request: Request) {
  return appWrite(request, 'planning screen', async ({ userId, today }, raw) => {
    const b = (raw ?? {}) as Body;
    const id = String(b.proposalId ?? '');
    let monday = weekOf(b.weekStart, today);
    let note: string | null = null;
    let r: { ok: true } | { error: string } | { weekStart: string; note: string };
    switch (b.action) {
      case 'draft':
        r = await draftWeek(userId, monday, b.answers && typeof b.answers === 'object' ? b.answers : {});
        break;
      case 'revise':
        if (!b.note?.trim()) return { status: 400, body: { error: 'note is required' } };
        r = await reviseDraft(userId, id, b.note.trim().slice(0, 1000));
        break;
      case 'undo':
        r = await undoDraft(userId, id);
        break;
      case 'edit':
        if (!b.op || !['move', 'length', 'remove'].includes(b.op.kind) || !Number.isInteger(b.op.index)) {
          return { status: 400, body: { error: 'op must be { kind: move|length|remove, index, … }' } };
        }
        r = await editDraftSession(userId, id, b.op);
        break;
      case 'accept':
        r = await acceptDraft(userId, id);
        if ('weekStart' in r) {
          monday = r.weekStart;
          note = r.note;
        }
        break;
      default:
        return { status: 400, body: { error: 'action must be draft, revise, undo, edit or accept' } };
    }
    if ('error' in r) return { status: 409, body: { error: r.error } };
    return { status: 200, body: { ...plannerApp(await loadPlannerWeek(userId, monday)), note } };
  });
}
