# Check-ins: change a week that has started

For `kind: "checkin"`. Paolo asks for one mid-week when the week has gone off plan or he feels different. The
request's `weekStart` is this week's Monday; `<current_week>` is the week as it is in Coach now, and the profile
gives today.

## What to keep and what to change

- **Past days stay as they were.** Put the sessions he did in `completed[]` with their actual values (the profile's
  training log), and plan only today and the days after it. Coach marks past workouts done or missed by itself.
- **Be surgical.** Change only what the request, the data or a skip gives a reason to change. Keep a future workout
  that `<current_week>` marks as changed on the web unless there is a clear reason; say so in `context`.
- The web already eases tomorrow's quality session after a Skip for tired, sore or sick, or a "how I feel: tired"
  (marked "adapted" in `<current_week>`). Read what it changed before you change more.
- Show the updated fitness (form now vs when the plan was made) in `review.reasoning`.

## Skipped and missed workouts, by reason

A missed workout is one with no matching activity and no skip; treat it as "other".

- **A missed lift is the one exception.** Lifts are the goal most at risk (2 a week grows the arms), so a lift
  skipped or missed for busy, travel or other moves once to the next aerobic or rest day this week: never on a
  workout day, at least 24 h from the other lift, stacked straight after that day's aerobic session (never a run
  after it). A 40 min version is fine. Write "Moved from Wed 21 Oct (busy)." at the start of its description.
  Tired, sore or sick: don't move it; the next lift is the regular one. Never two lifts on one day.
- **A missed physio session** moves once to the next rest or easy day this week, 48 h from the other one, for any
  reason but sick: it is 20 minutes and it is the rehab. Sore is a reason to do it at the last load, not to drop it.
  A week keeps at least one.
- **Never make up any other skipped workout.** Don't move it to a later day, don't add its TSS to other days, and
  don't stack two quality sessions to catch up. The week's TSS target drops by what was skipped.
- **Tired or sore**: a fatigue signal. The next day is easy or rest. The next quality session needs one easy day in
  front of it; if it is tomorrow, push it a day or make it aerobic. If it is the week's second fatigue skip (or HRV
  and sleep are down), cut the rest of the week's intensity and say so.
- **Sick**: rest until symptoms are gone, then 1–2 easy days before any intensity ("above the neck" mild cold: easy
  Z1–Z2 only). Drop the week's remaining quality sessions if it is mid-week or later.
- **Busy or travel**: no fatigue signal. Keep the plan; if the skipped session was the week's only quality session,
  it may replace an easy day later in the week, never next to another hard day.

## Common patterns

- Felt great and form recovering → keep the next quality session.
- Beat up → drop intensity, swap to easy.
- Weather got worse → outdoor to Zwift.
- A big life event (sick, injured, a surprise trip) → say in `review.watch` that next week's plan should account for
  it.
