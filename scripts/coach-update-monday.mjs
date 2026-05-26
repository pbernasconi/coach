import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const userId = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';

// Find the most recent active plan for this user
const [plan] = await sql`
  SELECT id FROM training_plans
  WHERE user_id = ${userId} AND status = 'active'
  ORDER BY created_at DESC LIMIT 1`;

if (!plan) { console.error('No active plan'); process.exit(1); }

// Update the Monday (2026-05-25) activity in-place
const updated = await sql`
  UPDATE training_plan_activities
  SET activity_type = 'Run',
      title         = 'Easy Run — Z1/Z2',
      description   = '~9–10km easy aerobic. Conversational pace, HR 130–145. First 10min very easy WU, last 5min cool-down.',
      intensity     = 'easy',
      duration      = 60,
      distance      = 10000,
      updated_at    = NOW()
  WHERE plan_id = ${plan.id}
    AND scheduled_date >= '2026-05-25T00:00:00Z'
    AND scheduled_date <  '2026-05-26T00:00:00Z'
  RETURNING id, title, activity_type, intensity, duration, distance, scheduled_date`;

console.log('Updated:', JSON.stringify(updated, null, 2));

// Refresh plan_content markdown so it stays in sync
const newContent = `# Training Plan — Week of May 25–31, 2026 (updated)

## Sessions

**Mon 5/25 — Easy Run Z1/Z2 (60min) ← updated**
- ~9–10km easy aerobic; HR 130–145; conversational pace.

**Tue 5/26 — Easy Run (40min)**
- ~6–7km Z1–Z2 AM before 5pm meeting.

**Wed 5/27 — Strength + Mobility (45min)**
- Squat 3×6, hinge 3×6, push 3×8, pull 3×8, core.

**Thu 5/28 — Bike Club Ride (1:30–3:30pm, on calendar)**
- Social Z2; hold back on climbs.

**Fri 5/29 — Tempo Run (45min: 10 wu / 20 tempo / 15 cd)**
- HR 155–165 on tempo block.

**Sat 5/30 — Rest / mobility (Al Hertz Bday)**

**Sun 5/31 — Long Run (70min Z2)**
- ~11km easy aerobic.

## Notes
Mon changed from 2h ride → 60min Z1/Z2 run per request. Week is now run-heavy (4 runs + 1 group ride + 1 strength); still ~6h total, well distributed.
`;

await sql`UPDATE training_plans SET plan_content = ${newContent}, updated_at = NOW() WHERE id = ${plan.id}`;
console.log('Plan content refreshed.');
