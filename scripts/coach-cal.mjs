import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const userId = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';

// Get latest event date across all connections to see how fresh DB is
const maxStart = await sql`
  SELECT MAX(start_time) as latest FROM calendar_events ce
  JOIN calendar_connections cc ON cc.id = ce.connection_id
  WHERE cc.user_id = ${userId}`;
console.log('Latest event in DB:', maxStart);

// Events in the next 14 days from "now"
const events = await sql`
  SELECT cc.google_email, ce.summary, ce.start_time, ce.end_time, ce.is_all_day, ce.status
  FROM calendar_events ce
  JOIN calendar_connections cc ON cc.id = ce.connection_id
  WHERE cc.user_id = ${userId}
    AND ce.start_time >= NOW()
    AND ce.start_time < NOW() + INTERVAL '14 days'
    AND ce.status <> 'cancelled'
  ORDER BY ce.start_time
  LIMIT 100`;
console.log('Upcoming 14d events:', events.length);
console.log(JSON.stringify(events, null, 2));
