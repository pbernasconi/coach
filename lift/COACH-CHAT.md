# Coach tab (exploration)

Status: proposal, nothing built. A native tab in the Lift app where Paolo talks to his coach to change the plan.

## The problem

The plan changes often: the calendar moves, and aches need a lighter day. Today a change means the Week tab's drag,
the web's Plan page, or a script. Paolo wants to say what changed and have Coach fix the week.

Example (Mon 2026-10-26): "No heavy lifting today, move it to tomorrow. I will run slow zone 2 with a friend instead."
Coach must:

1. Move Heavy barbell to Tuesday, in a free calendar window.
2. See that Tuesday now has two sessions (VO2 B and the lift) and propose to drop VO2 B.
3. Add an easy run today, and skip the unused Recovery spin.
4. Update Google Calendar and the Lift session.

## Principles

- **Server-side first.** The phone sends text and shows the answer. Claude, the tools, the rules and the writes are on
  the server, as for every other App API route.
- **Paolo approves every change.** Coach proposes a change set. Nothing is written until Paolo taps **Apply**. This
  is the same gate as the planner's Review (COACH.md): the context holds calendar text from other people.
- **One set of plan writes.** Apply calls the functions the web and the App API already use: `moveWorkout`,
  `setSkipped`, `updateWorkout`, `createWorkout`, `removeWorkout`, then `afterPlanWrite` (calendar push, Lift follows).
- **Coach's rules still hold.** Each change set goes through `rules.mjs` for the whole week. A broken rule shows on
  the card as a warning; the model gets the list and can fix it first, as in `loop.mjs`.

## How it works

```text
iPhone (Coach tab)                     Coach server (Vercel)                      Claude API
──────────────────                     ─────────────────────                      ──────────
text ─────────────── POST /api/app/coach/messages ──►  load thread, profile ──►  messages + tools
                                                       run read tools  ◄──────── get_week, get_calendar…
                                                       store proposal  ◄──────── propose_changes
reply + change card ◄── { reply, proposal } ─────────
Apply ────────────── POST /api/app/coach/proposals/{id}/apply ──►  existing plan writes, calendar, Lift
updated week card ◄──
```

### Tools for the model

| Tool | Kind | What it does |
| --- | --- | --- |
| `get_week(start)` | read | The Week API week (`week-api.mjs`): items, states, done, skips |
| `get_calendar(from, to)` | read | Free and busy blocks from Google Calendar (as the planner's `day-blocks.mjs`) |
| `get_readiness()` | read | Readiness, CTL/ATL/TSB, recent feel and soreness (the profile's numbers) |
| `get_workout_bank(sport)` | read | Bank workouts and levels, so an added run has real steps (`bankOptions`) |
| `propose_changes(changes, why)` | write proposal | A list of `move`, `skip`, `unskip`, `update`, `add`, `remove`; the server checks it and stores it |

The model never writes. `propose_changes` returns the check result: `ok`, or the broken rules to fix.

### Storage (new migration, DATABASE.md)

- `coach_threads`: `id`, `user_id`, `created_at`, `updated_at`. One open thread; a new one after 24 h idle.
- `coach_messages`: `id`, `thread_id`, `role` (`user | assistant`), `text`, `proposal_id`, `created_at`.
- `coach_proposals`: `id`, `thread_id`, `changes` jsonb, `why`, `warnings` jsonb, `status`
  (`open | applied | dismissed | stale`), `applied_at`. A proposal is stale when a workout it touches changed after it.
- Cost: each turn is a `plan_runs` row with `kind = 'chat'`, under its own monthly cap in `cost.mjs`.

### App API (new sections in APP-API.md)

- `GET /api/app/coach?tz=`: the open thread, its messages and open proposals.
- `POST /api/app/coach/messages?tz=` `{ text }`: answers `{ reply, proposal | null }`. First version: one JSON answer
  after the model is done (5–20 s); the phone shows a typing row. Server-sent events can come later.
- `POST /api/app/coach/proposals/{id}/apply?tz=`: applies it in one transaction, then the calendar push. Answers the
  new week items it touched. `409` when stale.
- `POST /api/app/coach/proposals/{id}/dismiss`.
- `POST /api/app/plan` (missing today): add a workout from the phone (`createWorkout`). Apply needs the same function.

### The iPhone tab

- Tab: **Coach**, symbol `bubble.left.and.text.bubble.right`.
- A message list and a text field. iOS dictation works in the field, so voice input needs no code at first.
- A change card under Coach's reply: one row per change ("Heavy barbell · Mon → Tue 09:00", "VO2 B · skip (busy)",
  "+ Easy Z2 run · Mon 16:00 · 45 min"), the warnings, and **Apply** and **Dismiss**. After Apply, the
  card shows "Applied" and the Week tab refreshes (`coachPlan` fetch).
- Quick prompts above the field for the common cases: "I'm sore", "Short on time today", "Move today to tomorrow".
- Offline: the field is off and says so. Nothing queues; a plan change needs the server.
- Lift's rule "No generated commentary" stays for every other tab. The Coach tab is the one place with model text.

## Decisions for Paolo

1. **Tab bar.** Lift has five tabs (Week, Today, Training, Lift, Settings). A sixth goes into "More". Options: move
   Settings to a toolbar button on Week (recommended), or merge Today into Week.
2. **Approve every change, or auto-apply small ones?** Recommended: approve every change at first. A later option:
   auto-apply a single move or skip with Undo, as the Week tab does.
3. **Monthly cap for chat.** About $0.03–0.10 a turn with the cached system prompt. Recommended: $10 a month,
   apart from the planner's $25.
4. **Coach starts the talk?** Later: a push after a skipped or missed session, or a bad readiness morning ("Your HRV is
   low. Swap today's threshold for an easy ride?"). Not in the first version.

## Build order

1. Server: tables, `propose_changes` checks with `rules.mjs`, the apply path, the routes, unit tests with a fake
   client (as `loop.test.mjs`), an integration test for apply. Deployed and usable with curl.
2. iPhone: the tab, the message list, the change card, Week refresh. Goes into the next batched TestFlight build.
3. Later: streaming, push-started check-ins, voice with the Speech framework.
