# Coach — how planning works

The routes and data sources are in COACH-API.md; the Lift sync contract is lift/SYNC.md.

Coach plans Paolo's training with the Claude API. There is one planner, in Coach itself (`src/lib/planner/`).
Nothing plans locally or in a GitHub job.

## When it plans

- **Every Sunday evening** it drafts next week from the data alone. `sync.yml` calls `POST /api/plan/run` each
  hour on Monday 02:17–07:17 UTC (Sunday 6–11 pm Pacific); the first call starts the plan, later calls see the week
  has one.
- **Any time**, the **Plan <week>** pill in the navbar opens the planning screen (`/plan/week`, full screen; an orange
  dot from Sunday 6 pm). It shows last week (what was done, fitness, how you feel), the week's shape (hours, lifts,
  hard sessions, long day, days off, the calendar events it plans around) and Coach's draft on the real calendar.
  A week that has started is planned as a check-in. A plan takes 1–3 minutes.

## Changing a draft

On the planning screen: drag a session to another time or day, or click it to move it to a free slot, change its
length or remove it (`draft.mjs` `editPlan`, saved in place). A note to Coach ("Tell Coach what to change", the
quick asks) or new answers on Shape make a new version (v2, v3): the screen lists what changed and what the week gave
up, and **Undo** brings the version before back (`proposals.ts` `reviseRequest`, `undoRevision`).

## How a plan is made

1. Coach stores the request (`plan_proposals`, status `requested`).
2. It builds the athlete profile for that week (`profile.mjs`) and, for a check-in, the week as it is now
   (`current-week.mjs`).
3. It sends Claude the system prompt (the four files in `src/lib/planner/prompts/`, cached) and the week (the request,
   the profile).
4. Claude hands the plan in with the `submit_plan` tool. Coach checks it in code: the format (`proposal.mjs`) and
   Paolo's rules (`rules.mjs`). A failed check goes back to Claude as a list to fix, 3 tries at most (`loop.mjs`).
5. The plan is saved as a proposal; each run is recorded in `plan_runs` (tokens, cost, tries, the rules the first
   draft broke).
6. The **Coach** tab of the planning screen shows the week, each session's reason, the key decisions and trade-offs, and what to
   watch (`review.mjs`). **Accept week** writes it into Coach (workouts changed on the web stay; a check-in keeps the days
   before it) and onto Google Calendar, then `plan-apply.yml` plans the Lift sessions and puts the runs on Garmin.
   Every workout always syncs.

Nothing reaches the calendar before Accept: the profile holds calendar text from other people, and the review is
the gate.

A run that can't plan (no key, over the budget, an API error, no valid plan in time) marks the request failed with
the reason, and the planning screen offers to try again.

## The prompts

| File | What it is |
| --- | --- |
| `prompts/planner.md` | The job: what Claude gets, the plan JSON it hands in, the review Paolo reads, weather, safety |
| `prompts/coaching.md` | The coaching rules: week shape, rotation, strength, physio, one session a day, floor weeks, principles |
| `prompts/check-in.md` | How to change a week that has started: past days stay, skips by reason |
| `prompts/plan-structure.md` | The coach's plan: week pattern, workout bank and progressions, lifts, physio, zones |

After editing a prompt file, run `node scripts/planner-prompt.mjs` (it bundles them into
`prompt-sources.generated.mjs`; `npm test` fails when the bundle is stale). A rule that must always hold also goes
into `src/lib/plan/rules.mjs`, so Coach checks it.

## Setup and cost

- Vercel: `ANTHROPIC_API_KEY` (the planner), `GITHUB_DISPATCH_TOKEN` (starts `plan-apply.yml` after an accept).
- GitHub: `CRON_SECRET`, `PROD_DATABASE_URL`, `LIFT_SYNC_TOKEN` (for `sync.yml` and `plan-apply.yml`).
- Claude Opus 5.5, adaptive thinking, medium effort: about $0.30–0.70 a plan. The planner stops for the month at
  $25 (`cost.mjs`); Settings → Planner shows the spend and the last run.

## Preferences and goals

They live in Coach, not in a chat or memory: Settings → Coaching preferences (printed in the profile), Settings →
Goals (milestones with a target and a deadline), the Lift templates (the strength programming).
