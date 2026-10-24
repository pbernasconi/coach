# Plan Structure (canonical — from coach's "Paolo Plan" PDF)

_This is the ultimate template for structuring every weekly calendar. Source: "Paolo Plan.pdf" (received via Messages, adopted 2026-07-05)._

## How /plan applies this plan

- The workout order is tracked in the database: `scripts/rotation.mjs` reads past plans and gives the next workouts and the last prescription of each one. A workout's `workoutType` names it: `ride-threshold-a`, `run-vo2-b`, and so on.
- Paolo's change: **never a heavy lift on the same day as a workout.** The heavy lift goes on an aerobic day.
- Paolo's change (2026-10-24): **one session a day, or one stacked block.** A lift on an aerobic day follows the
  easy aerobic part straight away (an easy run to the gym, or Zwift then the home lift), never hours later and never
  followed by a run. `.claude/commands/plan.md` has the rule and the floor-week and monthly rules.
- The goals (Coach → Settings → Goals) choose bike or run: at least 1 run workout each week for the 10k goal; rides for VO2 max and ride km.
- A 10k test run at goal pace (`run-test-10k`) replaces one workout about every 6 weeks. It does not move the order.
- From November to June, a ski tour (`ski-tour`) can replace the long ride as the weekend long aerobic day.

## Weekday Schedule

| Day | Type |
|---|---|
| Day 1 | Workout |
| Day 2 | Aerobic |
| Day 3 | Workout |
| Day 4 | Aerobic/recovery |
| Day 5 | Workout |

- Adjust as needed; if only one weekday is available, make it a workout.
- After a workout day, next day is aerobic or recovery — goal is to be recovered for the next workout.
- Lifts ideally go on workout days **after** the workout; can go any day, just never back-to-back. (Paolo's changes above win: heavy lifts on aerobic days, stacked right after the easy part.)

## Weekend Schedule

- Weekends = long run (with workout) + long bike. Either day order.
- If the long workout lands on Sunday, start the next week with an aerobic recovery day.
- Long rides: 2–6 h, mostly Z1/Z2. May incorporate a workout **only if the rest of the week was light**.
- Long runs: 90 min–3 h, mostly Z1, can have a solid Z2 component.
- Progress by adding time and lengthening time at the high end of Z2.

## Workout Rotation (cycle through in order; each has its own progression)

| # | Workout |
|---|---|
| 1 | Threshold A |
| 2 | VO2 A |
| 3 | VO2 B |
| 4 | Threshold B |
| 5 | Threshold A |
| 6 | VO2 A |

Progress each workout's own progression only if you hit the last one; if you failed, regress or repeat.

Focus: threshold + VO2 max, tempo as support, top-end speed as sprints on aerobic days + occasional sprint workouts.

On easy/long days: 6 × 6–8 s sprints (bike) or 4–6 × 20 s hard strides (run), ≥3 min full rest between (neuromuscular).

Zones: prescribe by HR for all but Z5 (HR needs ~5 min at wattage to settle); calibrate pace zones off HR; go by feel too. Z2 = strong but sustainable for many hours. Z4 = ~1 h sustainable. VO2 = 4–6 min sustainable.

## Workout Bank (bike; run mods noted)

### Threshold A
- 30 min warm up
- 6 × 5 min @ top end of Z4; 2 min recovery (start reasonable, end with a few left in tank)
- 10–20 min top end of Z2 (lactate clearance)
- Easy til end — 1 to 2.5 h total
- **Progression**: add sets up to 10 × 5
- Run: 10 min WU, max 90 min

### Threshold B
- 20 min warm up
- 5 × [1' Z4; 1' Z5 (~15–20 W above previous minute); 1' Z4; 1' Z5; 1' Z4; 3' easy]
- 10–20 min top end of Z2
- Easy til end — 1 to 2.5 h total
- **Progression**: add 1 min to a Z4 segment each time until set length = 8 min
- Run: 5 × [1' hard; 2' Z4; 3' easy]; max 1 h

### VO2 A
- 15 min easy warm up
- 4 × 3' hard; 3' easy (best sustainable — highest wattage maintainable across whole workout)
- 10–20 min top end of Z2 (**do not drop from this one**)
- Easy til end — 1 to 2.5 h total
- **Progression**: build sets to 5, then build reps (work + rest) by 30 s to 5 × 5
- Run: same; max 1 h

### VO2 B
- 15 min easy warm up
- 3 × [6 × 30 s hard / 30 s easy]; 5' easy between sets (best sustainable)
- 10–20 min top end of Z2
- Easy til end — 1 to 2.5 h total
- **Progression**: build each set to 10 (3 × [10 × 30/30]), then lengthen sets
- Run: 12 × 1' hard / 1' easy; max 1 h → build to 15 × 1/1, then decrease recovery

### Tempo (support)
- 15 min WU; 3 × 20' Z3 low cadence (60–70 rpm); 5' easy; 15' CD or extend
- **Progression**: add 5 min per interval
- Run: same, can shorten intervals

### Aerobic days
- 30–90 min Z1/Z2 (bike mostly Z2; run Z1/low Z2) + strides/sprints. Recover for the next workout.

### Gym Lift (heavy)
- Warm up circuit × 3: 15 stair climbers, 5 air squats, 5 burpees, 10 split jumps, 60 s rest
- 3 × 5: squat, Bulgarian split squats, single-leg RDL, weighted calf raises, [optional] pullups
- 3–5 reps, work to 3 × 5 at a weight then add weight, 3–5 min rest
- Short on time: squat + calf raise only

### Hotel Lift (power focus)
- ~50% 1RM, explosive intent, 60–90 s rest, not to failure
- Same warm-up circuit × 3
- Explosive: box split jump 3 × 5, box jump from seated × 3 (unweighted)
- Main: hamstring curl (ball) or single-leg DB RDL 3 × 8; pistol squat 3 × 8 (band-assisted OK); single-leg calf raise 3 × 8

### Home mini sessions (no gym; from the coach's TrainingPeaks library)

Short bodyweight / dumbbell sessions for home: prehab for the knees and Achilles, mobility after long days, and the
strength floor on travel or newborn weeks. They are not a third lift: use one on an aerobic or rest day, or in place of
a lift when the week is short. No Lift template: the exercise lines below ARE the session. Write them into the
workout's `description` exactly in this form (`1) Name 3x8: cue`), one per line, so Coach can make the Lift session
from them and every set can be logged (web "Log sets", phone Start workout). Holds and foam rolling stay plain lines
(no `NxM`), so they are not counted as sets. `activityType` strength; `workoutType` `strength-home` or `mobility`.

**Running Knee Strength** (coach's, ~40 min, 30 sets). Knees and calves for running.
1) Dumbbell Bulgarian split squat 3x8: each leg.
2) Step-up with knee raise 3x8: each leg.
3) Dumbbell seated single-leg calf raise 3x10: heavy weight, each leg.
4) Elevated single-leg calf raise 3x12: bodyweight, off a step, knee bent (soleus).
5) 90-90 3x10: hip switches.
6) Forward step down 3x8: each leg; a lateral step down also works.
7) Copenhagen plank 3x8: each side.
8) Kettlebell goblet squat 3x6: heels raised, get deep; kettlebell or barbell for weight.
9) Single-leg Romanian deadlift 3x8: each leg, weight to the outside of the foot.
10) Single-leg box squat 3x8: each leg.

**Mobility** (coach's, ~45 min, 31 sets). After long rides/runs or a stiff week.
Optional foam roll, 5 min: quads and hip flexors, glutes and IT band, calves, back and shoulders (1 min each).
1) World's greatest stretch 1x5: each side, slow.
2) Sumo squat to hamstring stretch 1x8
3) Shoulder CARs 1x5: each direction.
Stability, twice through:
4) 90-90 2x10
5) Single-leg Romanian deadlift 2x8: each leg, bodyweight.
6) Wall slides 2x15
7) Side-lying windmill 2x10: each side.
8) Glute bridge march 2x8: each leg.
Mobility stretch, twice through: couch stretch 1 min each side, pigeon stretch 1 min each side.
9) Thread the needle 2x10: each side.
10) Lying cactus stretch 2x10
Circuit: forearm plank 2 rounds of 45 s, side plank 2 rounds of 45 s each side.
11) Dead bug 2x10: each side.

**Knee & calf mini** (15 min, cut from Running Knee Strength; the default on a busy or newborn week).
1) Elevated single-leg calf raise 3x12: knee bent, off a step.
2) Standing calf raise 3x15: off a step, 3 s up, 3 s down.
3) Forward step down 3x8: each leg.
4) Copenhagen plank 2x8: each side.

**Arm finisher** (15 min, home dumbbells 15/20/25 lb and bands; straight after a Zwift ride, or to top up arm
volume on a week a lift fell off). Supersets, 60 s rest after each pair; go to 1–2 reps in reserve.
1) Dumbbell curl 3x12: 25 lb, slow 3 s down.
2) Overhead dumbbell triceps extension 3x12: one 25 lb dumbbell, both hands.
3) Hammer curl 3x12: 20 lb.
4) Band pushdown 3x15
5) Dumbbell lateral raise 2x15: 15 lb.
6) Push-up 2x12: to 1–2 reps in reserve.

**Mobility mini** (15 min, cut from Mobility; after a long ride or a travel day).
Couch stretch 1 min each side, pigeon stretch 1 min each side.
1) World's greatest stretch 1x5: each side.
2) 90-90 2x10
3) Glute bridge march 2x8: each leg.
4) Thread the needle 2x10: each side.
5) Dead bug 2x10: each side.

## Paolo's zone anchors (FTP 265 W, LTHR 168, max ~182+; FTP was 280 W until 2026-10-20)

| Zone | HR | Power |
|---|---|---|
| Z1 | <122 | <146 W |
| Z2 | 122–153 (top end ~145–153) | 148–199 W (top end ~186–199 W) |
| Z3 | 153–168 | 201–239 W |
| Z4 | 168–182 (top end ~175–182) | 241–278 W (top end ~254–276 W) |
| Z5/VO2 | max effort, HR lags | ~284–318 W (best sustainable) |
