import { neon } from '@neondatabase/serverless';
import { createId } from '@paralleldrive/cuid2';

const sql = neon(process.env.DATABASE_URL);
const userId = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';

// Week: Mon 2026-05-25 -> Sun 2026-05-31 (anchored to PDT mornings, stored as UTC)
const week = {
  start: new Date('2026-05-25T07:00:00.000Z'),  // Mon 00:00 PDT
  end:   new Date('2026-06-01T06:59:59.000Z'),  // Sun 23:59 PDT
};

const planContent = `# Training Plan — Week of May 25–31, 2026

## Context
- 7-month gap in synced Strava data; assuming partial detraining → conservative intensity.
- Wedding in Spain 6/6 → next week tapers; this week is a solid build.
- Bike club ride locked Thu 1:30–3:30pm PDT.

## Sessions

**Mon 5/25 — Long Ride (2h Z2 endurance)**
- ~50km rolling; avg HR 130–145; light fuel; pace conversational.

**Tue 5/26 — Easy Run (40min)**
- ~6–7km Z1–Z2; AM before 5pm meeting; focus on cadence + relaxed form.

**Wed 5/27 — Strength + Mobility (45min)**
- Squat 3×6, hinge 3×6, push 3×8, pull 3×8, core finisher.

**Thu 5/28 — Bike Club Ride (already on calendar, 1.5–2h)**
- Social Z2; hold back on climbs (you have a tempo run Fri).

**Fri 5/29 — Tempo Run (45min: 10 wu / 20 tempo / 15 cd)**
- Tempo block at HR 155–165 / comfortably hard / can speak 3-word sentences.

**Sat 5/30 — Rest / mobility (Al Hertz birthday)**
- Optional 20min walk + stretch. Hydrate, eat well.

**Sun 5/31 — Long Run (70min Z2)**
- ~11km; first 60 easy, last 10 slight pickup but still aerobic.

## Weekly Load
~5h riding + ~2.5h running + 0.75h lifting = ~8h. Two quality (Fri tempo, Thu group). Rest endurance.
`;

const goals = {
  primarySport: 'multisport (run + bike)',
  goalType: 'maintain_endurance',
  notes: 'Wedding in Spain Jun 6; conservative reentry after data gap.',
  daysPerWeek: 5,
  inferredFromActivity: true,
};

const contextData = {
  recentActivitySummary: {
    lastActivity: '2025-10-03 (snapshot, last_synced_at null)',
    pattern: 'Mix of 7-13km runs and 40-70km Mallorca rides with 500-2000m climbing; occasional lifting; VO2 session on 2025-10-01.',
  },
  calendarSummary: 'Memorial Day free; Tue/Wed evenings booked; Thu midday bike club + evening meetings; Fri light; Sat social; Sun open.',
  assumptions: ['Timezone America/Los_Angeles', 'No explicit user_goals row — defaults inferred'],
};

const planId = createId();
await sql`
  INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, goals, context_data, status)
  VALUES (${planId}, ${userId}, ${week.start}, ${week.end}, ${planContent}, ${'claude-opus-4-7'}, ${JSON.stringify(goals)}, ${JSON.stringify(contextData)}, 'active')
`;

// Activities — schedule each at the user's local-morning time (or the booked window for Thu).
// scheduledDate stored as UTC.
const activities = [
  {
    date: new Date('2026-05-25T15:00:00.000Z'), // Mon 8am PDT
    type: 'Ride', title: 'Long Ride — Z2 endurance', intensity: 'easy',
    durationMin: 120, distanceM: 50000,
    description: '~50km rolling, avg HR 130–145, conversational. Light fuel; hydrate.',
  },
  {
    date: new Date('2026-05-26T14:00:00.000Z'), // Tue 7am PDT
    type: 'Run', title: 'Easy Run', intensity: 'easy',
    durationMin: 40, distanceM: 7000,
    description: '~6–7km Z1–Z2 before evening meeting. Relaxed cadence.',
  },
  {
    date: new Date('2026-05-27T14:00:00.000Z'), // Wed 7am PDT
    type: 'WeightTraining', title: 'Strength + Mobility', intensity: 'moderate',
    durationMin: 45, distanceM: null,
    description: 'Squat 3×6, hinge 3×6, push 3×8, pull 3×8, 5min core finisher.',
  },
  {
    date: new Date('2026-05-28T20:30:00.000Z'), // Thu 1:30pm PDT — matches Bike club calendar event
    type: 'Ride', title: 'Bike Club Ride (group)', intensity: 'moderate',
    durationMin: 110, distanceM: 45000,
    description: 'Social Z2 with bike club. Hold back on climbs — tempo run is Friday.',
  },
  {
    date: new Date('2026-05-29T14:00:00.000Z'), // Fri 7am PDT
    type: 'Run', title: 'Tempo Run (10/20/15)', intensity: 'hard',
    durationMin: 45, distanceM: 8500,
    description: '10min easy WU, 20min @ tempo (HR 155–165), 15min easy CD.',
  },
  {
    date: new Date('2026-05-30T16:00:00.000Z'), // Sat 9am PDT — rest
    type: 'Rest', title: 'Rest / Mobility', intensity: 'recovery',
    durationMin: 20, distanceM: null,
    description: '20min walk + stretch. Birthday social — hydrate, eat well.',
  },
  {
    date: new Date('2026-05-31T15:00:00.000Z'), // Sun 8am PDT
    type: 'Run', title: 'Long Run — Z2', intensity: 'moderate',
    durationMin: 70, distanceM: 11000,
    description: '~11km Z2; last 10min slight pickup but still aerobic.',
  },
];

for (const a of activities) {
  await sql`
    INSERT INTO training_plan_activities
      (id, plan_id, activity_type, title, description, scheduled_date, duration, distance, intensity, is_completed)
    VALUES
      (${createId()}, ${planId}, ${a.type}, ${a.title}, ${a.description}, ${a.date}, ${a.durationMin}, ${a.distanceM}, ${a.intensity}, false)
  `;
}

console.log('Plan inserted:', planId);
console.log('Activities inserted:', activities.length);

// Verify
const verify = await sql`
  SELECT title, activity_type, intensity, scheduled_date, duration, distance
  FROM training_plan_activities WHERE plan_id = ${planId}
  ORDER BY scheduled_date`;
console.log('\n=== VERIFY ===');
console.log(JSON.stringify(verify, null, 2));
