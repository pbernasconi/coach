---
description: Book (or check, or cancel) an MX3 Fitness private station, e.g. "/gym castro 3 tue 2pm". Adds the booking to the calendar.
---

# /gym — MX3 station booking

Arguments: `$ARGUMENTS` (free text, e.g. `tue 2pm`, `castro 3 tomorrow 6:30am`, `status`, `what's free wed afternoon`, `cancel tue 2pm`).

All MX3 access goes through `scripts/mx3.mjs`. It needs `MX3_USERNAME` / `MX3_PASSWORD`
(in `.env.local` on the Mac, or the cloud environment's variables). Run it as
`/opt/homebrew/bin/node --env-file=.env.local scripts/mx3.mjs …` on the Mac, plain `node scripts/mx3.mjs …` in the cloud.
If the variables are missing, say so in one line and stop. Never ask for the password in chat.

## Never do this
- **Never book a slot that is already yours.** On mx3fitness.com, clicking your own slot cancels it.
  The script already refuses; don't work around it with curl or a browser.
- Never cancel without the user explicitly asking to cancel that booking in this conversation.

## Steps

1. **Parse the ask.** Location defaults to `castro`. Station: a number (`3`) or name (`Castro 3`); if none is given,
   any free station is fine (prefer the one he booked most recently, from `status`). Date: `YYYY-MM-DD`, `today`,
   `tomorrow` or a weekday. Time: `2pm`, `6:30am`. If the time is vague ("afternoon"), run step 2 and offer the free
   times in one line instead of guessing.

2. **Look:** `scripts/mx3.mjs slots --date <d> [--time <t>] [--station <n>] --json`
   (and `status --json` for credits and current bookings).

3. **Book:** `scripts/mx3.mjs book --date <d> --time <t> --station <n> --json`.
   A specific "book X" request is the go-ahead; don't ask again. If the slot is taken, offer the nearest free
   times at the same station and any station free at that exact time.

4. **Calendar:** for a confirmed booking (`ok: true` and not `already`), add an event to the personal Gmail calendar
   (`paolo.enrico.bernasconi@gmail.com`, colorId `3` purple, timezone America/Los_Angeles) titled
   `Gym: MX3 <station>` with location `MX3 Fitness Castro, San Francisco`, using the JSON's `calendar.start`/`calendar.end`.
   Use the Google Calendar connector if it is available; otherwise give the `calendar.link` (one tap adds it).
   Check first that the calendar does not already have a `Gym: MX3` event at that time.

5. **Cancel** (only when asked): `status --json` to find the id, then `cancel --id <id> --confirm`.
   Then delete the matching `Gym: MX3` calendar event. MX3 only allows cancelling at least 1 hour before.

6. **Reply in one or two lines:** what is booked, credits left, and that it is on the calendar.

The same booking flow is in the web app at `/gym` (phone-friendly).
