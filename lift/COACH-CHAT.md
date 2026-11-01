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

Built (2026-10-26) simpler than first drawn: no read tools at first (they came 2026-11-01, below). Each message from Paolo goes with the context, so one
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
  A lift is structured as the planner writes it: an added gym lift names its Lift template (`liftTemplate`, one of
  the profile's templates; stored in `lift_template` with `strength-heavy`/`strength-dumbbell`) and its description
  is a short coach's note (`liftNoteProblem`: no exercise lines or numbered steps, at most 300 characters), on add
  and on update. A home or physio session is `workoutType` `strength-home`/`mobility` with its `1) Name 3x8: cue`
  lines. Apply of a new gym lift starts plan-apply.yml, so Lift plans its session (exercises, sets, warm-up sets)
  right away; the hourly backstop catches a failed start.

- Two more tools: `show({ kind, ref })` puts a card under the text (workout, week, exercise, readiness, day; the
  server fills it, cards.ts) and `suggest_replies({ options })` adds up to 3 one-tap answers to a question.

- Read tools (2026-11-01, `data-tools.mjs`, run by `data.ts`). The chat told Paolo "my data has no splits" about a
  run whose splits, laps and best efforts were stored, and asked him for the time. Now it reads them:
  `get_activity({ ref })` (an activity id: `<plan>` shows it after DONE; "latest"; or a day) answers with km splits
  (pace, GAP, HR), manual laps, halves and HR drift, best efforts ranked against his `activity_peaks` history (year
  and all time), zones, the watch's training effect, weather, the planned workout, the load around it and earlier
  runs on the route, all from `loadActivity` (the activity page's loader). `find_activities({ from, to, sport })`,
  `get_bests()` (`loadPeakPerformances`) and `get_load({ weeks })` (`daily_training_load` and hours by sport per
  week). Reads run side by side, the phone shows "reading", at most 6 per answer, 6 requests per turn
  (`MAX_TURNS`). Each answer's `meta.dataReads` lists them. coach-chat.md "Looking things up" says to read before
  judging a session, test or load, and to explain the numbers.

The model never writes. The system prompt is coach-chat.md, coaching.md, check-in.md (skips by reason, a missed
lift moves once) and plan-structure.md (cached).

### Storage (new migration, DATABASE.md)

- `coach_threads`: `id`, `user_id`, `created_at`, `updated_at`. One open thread; a new one after 24 h idle.
- `coach_messages`: `id`, `thread_id`, `role` (`user | assistant`), `text`, `proposal_id`, `created_at`.
- `coach_proposals`: `id`, `thread_id`, `title`, `why`, `changes` jsonb (the ops and what each workout looked
  like), `items` and `warnings` jsonb (the card), `status` (`open | applied | undone | dismissed | stale`), `undo` jsonb. A proposal is stale when a workout it touches changed after it.
- Cost: every answer and cache warm-up writes a row to `ai_usage` (DATABASE.md, "What Claude costs"); the chat stops
  at $10 a month (`CHAT_MONTHLY_CAP_USD`), counted there. Each message also keeps its own `cost_usd`.
- Kept for analysis (migration 0020): every message, and with each answer `context` (the `<now>`, `<plan>` and
  `<profile>` Claude got) and `meta` jsonb: `stop`, `turns`, `usage` (tokens and USD), `latencyMs`, `attempts` (each
  `propose_changes` input and the problems the check sent back), `prompt` (a hash of the system prompt), `error`.
  A card's outcome is its proposal's `status` and `decided_at`. One row per answer with its card:

  ```sql
  SELECT u.text AS asked, a.text AS answer, p.title, p.status, p.decided_at, a.cost_usd,
         a.meta->>'latencyMs' AS ms, jsonb_array_length(COALESCE(a.meta->'attempts', '[]')) AS tries
  FROM coach_messages a
  JOIN LATERAL (SELECT text FROM coach_messages u WHERE u.thread_id = a.thread_id AND u.role = 'user'
                AND u.created_at <= a.created_at ORDER BY u.created_at DESC LIMIT 1) u ON true
  LEFT JOIN coach_proposals p ON p.id = a.proposal_id
  WHERE a.role = 'assistant' ORDER BY a.created_at;
  ```

### App API (new sections in APP-API.md)

- `GET /api/app/coach?tz=`: the open thread, its messages and open proposals.
- `POST /api/app/coach/messages?tz=` `{ text }`: answers `{ reply, proposal | null }`. First version: one JSON answer
  after the model is done (5–20 s); the phone shows a typing row. Server-sent events can come later.
- `POST /api/app/coach/proposals/{id}/apply?tz=`: applies it (see "Applying"), then the calendar push. Answers the
  days it touched. `409` when stale.
- `POST /api/app/coach/proposals/{id}/dismiss`.
- `POST /api/app/plan` (missing today): add a workout from the phone (`createWorkout`). Apply needs the same function.

### The iPhone tab

- Tab: **Coach**, symbol `bubble.left.and.text.bubble.right`.
- A message list and a composer. At rest the composer is a one-line capsule; with focus (or while the microphone
  listens) it opens into a card: the field on top and a toolbar with the microphone and Send under it. A tap on the
  conversation closes the keyboard; so does a drag down.
- The microphone (Kobo's `ChatVoice`, rules in `ChatVoiceInput`): a tap puts the words in the field as they are heard,
  and a second tap or a 2 s pause stops; holding talks, and the release sends (nothing heard sends nothing). Speech is
  turned into text on the iPhone (`LiveSpeechTranscriber`, `SFSpeechRecognizer` with on-device recognition). Both
  permissions are asked on first use; when they are off, a row under the field links to Settings. Listening stops when
  the tab or the app goes away. Demo data hears a made-up sentence (`-voice denied` shows the denied row).
- A change card under Coach's reply (see "The change card"), the warnings, and **Apply** and **Dismiss**. After
  Apply, the card shows "Applied" with **Undo**, and the Week tab refreshes (`coachPlan` fetch). A newer proposal
  marks the older open one "Replaced".

### The change card

Paolo, 2026-10-29: the first card (a glyph, an emoji and struck-through times on every row) was cluttered, and scary to
apply after Apply had made bugs. The card is the plan by day (`cardOf` in changes.mjs, `days` in APP-API.md): a header
per day the card touches, each row as it will be after Apply with a sport icon, the time and length, and one quiet tag
("From Sat", "Earlier", "Skipped", "New"). A skip and an add on the same day are one row ("replaces Long ride").
Concepts and the states after Apply: https://claude.ai/artifact/RPhYcmJgGfjG3Kmh8NYca2.

### Applying

Apply (`applyProposal` in server.ts) has to be safe to tap without reading every row twice:

1. **Once.** It claims the card first (`open → applied` in one UPDATE): a double tap or a retry gets 409.
2. **On the plan as it is now.** Every workout the card touches must be as Coach saw it (`basis`, fingerprints of
   day, time, status, title, length, effort, Lift template and notes), and `recheck` runs the change checks again
   at the tap: no day now in the past, no workout now done, no new copy of a lift in the week, no new rule break.
   Else nothing is written and the card is stale, with the reason.
3. **All or nothing.** A write that fails puts back the writes before it. A put-back that fails too is named on the
   card ("check Heavy barbell on the Week tab"), never "nothing changed".
4. **Read back.** After the writes the plan is read again and each change checked (`landedIssues`); one that didn't
   land is named in `result`. The fingerprints then are kept with the Undo steps (`undo` jsonb: `{ steps, after,
   result }`, undo-record.mjs).
5. **Undo never overwrites Paolo.** Undo puts a workout back only while it is as Apply left it (`undoPlan`); one he
   moved, edited or did since stays, after he confirms ("Undo 4 of 5?"). An edit's Undo puts back the exact effort,
   TSS, steps and type too, not the Edit sheet's defaults.
6. **Moves stay moves.** A skip or delete plus an add of the same workout in the week goes back to the model as "use
   move" (`moveAsAddIssues`), as a copy of a lift already does (2026-10-27).
- The steps Coach took show above its reply ("Read this week's plan", "Checked Tuesday's calendar"): real tool calls
  only, never made-up progress. While it works, three dots and the current step.
- The transcript opens at the latest message and follows new ones while Paolo is at the bottom; scrolled up by hand
  more than about one and a half screens, it stays and shows a jump-to-latest button.
- Leaving the app while Coach answers: the message's request runs as a background task, and the server finishes the
  answer either way and pushes it (`coach.replied`, `lift://coach`; no banner while the conversation shows). The tab
  reads the conversation again whenever it shows or the app comes back; while `answering` is true it shows the typing
  row and reads it again every 3 s.
- Quick prompts above the field for the common cases: "I'm sore", "Short on time today", "Move today to tomorrow".
- Offline: the field is off and says so. Nothing queues; a plan change needs the server.
- Lift's rule "No generated commentary" stays for every other tab. The Coach tab is the one place with model text.

## Speed

A reply used to take 15–30 s with nothing on screen but the typing dots. Where the time went, and what changed
(2026-10-27):

- **Claude's thinking** was most of it: Opus 5.5 at `medium` effort thinks 15–20 s before its first word. The chat
  runs at `low` (`EFFORT` in chat.mjs), a few seconds; the server still checks every change, so a slip is sent back
  to be fixed rather than reaching the plan.
- **Nothing streamed.** The answer now streams (APP-API.md, "Coach answer stream"): a status line within a second,
  a summary of Claude's thinking, then the words as they are written. The card comes with the last event. The
  Coach tab shows the status line (the latest line of the thinking while Claude thinks) beside the typing dots,
  then the reply growing word by word (`LiveCoachChat.replies`, `CoachStreamWire`, LiftSync's
  `ServerSentEventParser`).
- **Reads before Claude.** The plan, the profile (about 15 queries and a weather fetch) and the budget check run side
  by side, while the message is stored.
- **Cold cache.** Opening the tab warms Claude's cache of the system prompt and tools (`warmCoach`, a `max_tokens: 0`
  request, at most every 10 minutes per server instance). A repair request reads the message's context from the
  cache too.
- **Model.** Since 2026-10-27 the chat runs on Sonnet 5.5 (`MODEL` in chat.mjs): about 3 s to the first word where Opus
  5.5 took about 7 (public benchmarks), at half the price per token. The planner stays on Opus 5.5.
- Each reply's `meta` keeps `prepMs`, `timing` (first thinking, first word, each request) and `latencyMs`, so the
  next change can be measured.

## Attachments

Paolo can add photos and files to a message (2026-10-27): a physio sheet, a screenshot of a workout, a photo of a
stretch or a meal. The composer's + opens the Kobo attach sheet (`ChatAttachSheet`): the camera, his recent photos
(tap to pick several, then "Attach N photos"), the full photo library, and files. Picked items sit above the field
as thumbnails with a remove button (`ChatAttachmentStrip`) and upload at once; Send waits for them.

- The phone shrinks a photo to 1568 px (JPEG 0.8) and converts HEIC; each upload is `POST /api/app/coach/files`,
  then the message names their ids (APP-API.md, "Coach attachments").
- The bytes live in `coach_files` (Postgres bytea); the message keeps their refs in `coach_messages.files`.
- Claude gets photos as image blocks, PDFs as document blocks and text files as text documents, before Paolo's
  words. The newest 6 files of the thread go again with every later message; older ones are a line. A photo costs
  about 1,600 input tokens (about $0.01).
- Code: `src/lib/coach-chat/files.mjs` (what a file is, how Claude reads it), `files-store.ts` (storage).

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
3. Later: streaming, push-started check-ins.

## Look (2026-10-29)

The tab follows Ramp's assistant chat, in Coach's orange. No navigation title: a glass pill at the top right holds
Settings (the Settings tab), past chats (a sheet; a tap reopens that chat, `POST /api/app/coach/threads/{id}`) and
New chat (`POST /api/app/coach/threads`). An empty chat shows Coach's ring, "Hi Paolo," / "How can Coach help?" and
three starter cards (`prompts` from the server, else the built-in ones). The composer is a glass capsule that opens
into a card once there is a draft; Send is always there (grey, orange, or a stop square). Paolo's messages are warm
grey bubbles; Coach's replies are plain text with a folded "Thought" row above (`thought`), cards under it (a
`breakdown` card shows training time by sport), question cards on the latest reply (`questions`, sent back as one
message of `title: answer` lines; quick replies show as a one-tap chip card), and thumbs and copy under every reply
(`PUT …/messages/{id}/feedback`). The Kobo parts: `ChatThoughtRow`, `ChatFeedbackRow`, `ChatQuestionCard`,
`ChatQuestions`, `ChatBreakdownCard`, `ChatGreeting`, `ChatPromptCards`, `ToolbarPill` and `.chatCard()`.
Screenshots: `-demo -tab coach -coach conversation|questions|proposal` (DemoCoachThreads).
