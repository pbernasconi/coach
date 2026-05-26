import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const users = await sql`SELECT id, email, first_name, last_name, timezone FROM users ORDER BY created_at DESC LIMIT 5`;
console.log('=== USERS ===');
console.log(JSON.stringify(users, null, 2));

if (users.length === 0) {
  console.log('No users.');
  process.exit(0);
}

const me = users.find(u => u.email === 'penrico@column.com') || users[0];
console.log('\n=== USING USER ===', me.id, me.email);

const goals = await sql`SELECT * FROM user_goals WHERE user_id = ${me.id}`;
console.log('\n=== USER GOALS ===');
console.log(JSON.stringify(goals, null, 2));

const cals = await sql`SELECT id, google_email, is_active, last_synced_at FROM calendar_connections WHERE user_id = ${me.id}`;
console.log('\n=== CALENDAR CONNECTIONS ===');
console.log(JSON.stringify(cals, null, 2));

const strava = await sql`SELECT id, athlete_id, is_active, last_synced_at FROM strava_connections WHERE user_id = ${me.id}`;
console.log('\n=== STRAVA CONNECTIONS ===');
console.log(JSON.stringify(strava, null, 2));

const acts = await sql`
  SELECT name, type, sport_type, distance, moving_time, total_elevation_gain,
         start_date_local, average_heartrate, max_heartrate, average_speed
  FROM strava_activities
  WHERE user_id = ${me.id}
  ORDER BY start_date_local DESC NULLS LAST
  LIMIT 20`;
console.log('\n=== LAST 20 STRAVA ACTIVITIES ===');
console.log(JSON.stringify(acts, null, 2));

const plans = await sql`
  SELECT id, week_start_date, week_end_date, status, created_at, LEFT(plan_content, 120) as preview
  FROM training_plans WHERE user_id = ${me.id}
  ORDER BY week_start_date DESC LIMIT 5`;
console.log('\n=== EXISTING TRAINING PLANS ===');
console.log(JSON.stringify(plans, null, 2));
