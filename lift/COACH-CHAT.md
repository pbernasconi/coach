# Coach tab (exploration)

Status: built. The server is `src/lib/coach-chat/` (lift/APP-API.md "Coach"); the iPhone tab replaces Training with
**Coach** (`Lift/Features/Coach/`). A native tab in the Lift app where Paolo talks to his coach to change the plan.

The tab talks to the server through `LiveCoachChat` (its own App API session, 60 s timeout, the sync token) whenever
the data syncs; demo and practice data use `DemoCoachChat` (sample replies, changes nothing). Both sit behind
`CoachChatting`; `CoachWire` maps the JSON (items "added", "removed", "changed" with "old → new" split into the card's
struck-through rows; status "stale" shows as expired). After Apply or Undo, the Week tab fetches the plan again. Its
parts are Kobo components (`ios-standards/Kobo/Sources/KoboComponents/Chat/`): `ChatTranscript`, `ChatComposer`,
`ChatMessageBubble`, `ChatReply`, `ChatTypingIndicator`, `ChatToolStatus`, `ChatActionCard`, `ChatPromptSuggestions`
and `ChatErrorRow`. Activity pages that Training opened now open on Week.

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

### What the model gets

Built (2026-10-26) simpler than first drawn: no read tools. Each message from Paolo goes with the context, so one
request usually answers it:

- `<now>`, `<plan>`: every workout from this Monday to the Sunday after next with its id and state (`planText`),
  and `<profile>`: the planner's profile for two weeks (calendar, readiness, recent sessions, Lift notes, goals).
- One tool, `propose_changes({ title, why, changes })`, with `move`, `skip`, `unskip`, `update`, `add`, `remove`
  and `remember` (a lasting preference: on Apply it goes under "## From Coach chat" in Settings → Coaching
  preferences, which the chat and the planner read; Undo takes only that line out).
  The server checks it (`checkProposalInput`): a bad id, a done workout, the past or a bad time goes back to fix; a
  plan rule the changes newly break goes back once, then shows on the card as a warning. So does a skip of today for
  tired, sore or sick that leaves a quality session today or tomorrow (`fatigueIssues`): the web's Skip eases the
  next session by itself, a chat card must do it in its own rows. Up to 3 tries.

The model never writes. The system prompt is coach-chat.md, coaching.md, check-in.md (skips by reason, a missed
lift moves once) and plan-structure.md (cached).

### Storage (new migration, DATABASE.md)

- `coach_threads`: `id`, `user_id`, `created_at`, `updated_at`. One open thread; a new one after 24 h idle.
- `coach_messages`: `id`, `thread_id`, `role` (`user | assistant`), `text`, `proposal_id`, `created_at`.
- `coach_proposals`: `id`, `thread_id`, `title`, `why`, `changes` jsonb (the ops and what each workout looked
  like), `items` and `warnings` jsonb (the card), `status` (`open | applied | undone | dismissed | stale`), `undo` jsonb. A proposal is stale when a workout it touches changed after it.
- Cost: each Coach message stores its `cost_usd`; the chat stops at $10 a month (`CHAT_MONTHLY_CAP_USD`).

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
- A change card under Coach's reply: one row per change, the old value struck through before the new one ("Heavy
  barbell · ~~Mon 17:00~~ → Tue 09:00"), the warnings, and **Apply** and **Dismiss**. After Apply, the card shows
  "Applied" with **Undo**, and the Week tab refreshes (`coachPlan` fetch). A newer proposal marks the older open one
  "Replaced".
- The steps Coach took show above its reply ("Read this week's plan", "Checked Tuesday's calendar"): real tool calls
  only, never made-up progress. While it works, three dots and the current step.
- The transcript opens at the latest message and follows new ones while Paolo is at the bottom; scrolled up, it stays
  and shows a jump-to-latest button.
- Quick prompts above the field for the common cases: "I'm sore", "Short on time today", "Move today to tomorrow".
- Offline: the field is off and says so. Nothing queues; a plan change needs the server.
- Lift's rule "No generated commentary" stays for every other tab. The Coach tab is the one place with model text.

## Decisions for Paolo

1. **Tab bar.** Decided: Coach replaces Training (Week, Today, Coach, Lift, Settings).
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
