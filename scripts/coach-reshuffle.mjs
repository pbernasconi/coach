import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const userId = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';

// === 1. Fetch weather forecast for SF, May 25–31 PDT ===
const wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max,sunrise,sunset' +
  '&timezone=America/Los_Angeles&forecast_days=7&temperature_unit=fahrenheit&wind_speed_unit=mph';
const wxRes = await fetch(wxUrl);
const wx = await wxRes.json();

const codeMap = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'fog (rime)',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow',
  80: 'showers', 81: 'showers', 82: 'heavy showers',
  95: 'thunderstorm',
};

const wxByDate = {};
for (let i = 0; i < wx.daily.time.length; i++) {
  const d = wx.daily.time[i];
  wxByDate[d] = {
    hi: Math.round(wx.daily.temperature_2m_max[i]),
    lo: Math.round(wx.daily.temperature_2m_min[i]),
    precipIn: wx.daily.precipitation_sum[i],
    precipPct: wx.daily.precipitation_probability_max[i],
    wind: Math.round(wx.daily.wind_speed_10m_max[i]),
    desc: codeMap[wx.daily.weather_code[i]] || `code ${wx.daily.weather_code[i]}`,
  };
}
console.log('Weather (SF):');
for (const [d, w] of Object.entries(wxByDate)) {
  console.log(`  ${d}: ${w.lo}–${w.hi}°F, ${w.desc}, wind ${w.wind}mph, precip ${w.precipPct ?? 0}% (${w.precipIn ?? 0}in)`);
}

// === 2. Find active plan ===
const [plan] = await sql`
  SELECT id FROM training_plans
  WHERE user_id = ${userId} AND status = 'active'
  ORDER BY created_at DESC LIMIT 1`;
if (!plan) { console.error('No plan'); process.exit(1); }

// === 3. Build new week schedule ===
// Mon: Easy Run (already correct, just refresh weather)
// Tue: Strength (was Easy Run)
// Wed: Bike Endurance (was Strength)
// Thu: Bike Club (unchanged, already on calendar)
// Fri: Tempo Run (unchanged)
// Sat: Rest (unchanged)
// Sun: Long Run (unchanged)

function wxNote(dateStr) {
  const w = wxByDate[dateStr];
  if (!w) return '';
  return `Weather: ${w.lo}–${w.hi}°F, ${w.desc}, ${w.precipPct ?? 0}% precip, wind ${w.wind}mph.`;
}

const sessions = [
  {
    date: new Date('2026-05-25T15:00:00.000Z'), // Mon 8am PDT
    localDate: '2026-05-25',
    type: 'Run', title: 'Easy Run — Z1/Z2', intensity: 'easy',
    durationMin: 60, distanceM: 10000,
    description: '~9–10km easy aerobic. Conversational pace, HR 130–145.',
  },
  {
    date: new Date('2026-05-26T14:00:00.000Z'), // Tue 7am PDT
    localDate: '2026-05-26',
    type: 'WeightTraining', title: 'Strength + Mobility', intensity: 'moderate',
    durationMin: 45, distanceM: null,
    description: 'Squat 3×6, hinge 3×6, push 3×8, pull 3×8, 5min core. Indoors — weather irrelevant.',
  },
  {
    date: new Date('2026-05-27T14:00:00.000Z'), // Wed 7am PDT
    localDate: '2026-05-27',
    type: 'Ride', title: 'Bike — Z2 Endurance', intensity: 'easy',
    durationMin: 90, distanceM: 35000,
    description: '~35km flat-to-rolling, HR 130–145, conversational. Keep it endurance — Thu is the group ride.',
  },
  {
    date: new Date('2026-05-28T20:30:00.000Z'), // Thu 1:30pm PDT
    localDate: '2026-05-28',
    type: 'Ride', title: 'Bike Club Ride (group)', intensity: 'moderate',
    durationMin: 110, distanceM: 45000,
    description: 'Social Z2 with bike club. Sit in on climbs — tempo run is tomorrow.',
  },
  {
    date: new Date('2026-05-29T14:00:00.000Z'), // Fri 7am PDT
    localDate: '2026-05-29',
    type: 'Run', title: 'Tempo Run (10/20/15)', intensity: 'hard',
    durationMin: 45, distanceM: 8500,
    description: '10min easy WU, 20min @ tempo (HR 155–165, comfortably hard), 15min easy CD.',
  },
  {
    date: new Date('2026-05-30T16:00:00.000Z'), // Sat 9am PDT
    localDate: '2026-05-30',
    type: 'Rest', title: 'Rest / Mobility', intensity: 'recovery',
    durationMin: 20, distanceM: null,
    description: '20min walk + stretch. Al Hertz birthday — hydrate, eat well.',
  },
  {
    date: new Date('2026-05-31T15:00:00.000Z'), // Sun 8am PDT
    localDate: '2026-05-31',
    type: 'Run', title: 'Long Run — Z2', intensity: 'moderate',
    durationMin: 70, distanceM: 11000,
    description: '~11km Z2; first 60 easy, last 10min slight pickup but still aerobic.',
  },
];

// Append weather note to each (outdoor sessions only — strength gets a stub)
for (const s of sessions) {
  if (s.type !== 'WeightTraining') {
    s.description = `${s.description}\n\n${wxNote(s.localDate)}`;
  }
}

// === 4. Wipe & re-insert activities for this plan ===
await sql`DELETE FROM training_plan_activities WHERE plan_id = ${plan.id}`;
const { createId } = await import('@paralleldrive/cuid2');
for (const a of sessions) {
  await sql`
    INSERT INTO training_plan_activities
      (id, plan_id, activity_type, title, description, scheduled_date, duration, distance, intensity, is_completed)
    VALUES
      (${createId()}, ${plan.id}, ${a.type}, ${a.title}, ${a.description}, ${a.date}, ${a.durationMin}, ${a.distanceM}, ${a.intensity}, false)
  `;
}

// === 5. Refresh plan_content markdown ===
const wxLine = (d) => {
  const w = wxByDate[d];
  return w ? `${w.lo}–${w.hi}°F · ${w.desc} · ${w.precipPct ?? 0}% precip · wind ${w.wind}mph` : '';
};

const newContent = `# Training Plan — Week of May 25–31, 2026
_Location: San Francisco · weather via Open-Meteo_

| Day | Session | Weather (SF) |
|---|---|---|
| **Mon 5/25** | **Easy Run Z1/Z2 — 60min, ~10km** | ${wxLine('2026-05-25')} |
| **Tue 5/26** | **Strength + mobility — 45min** | indoor |
| **Wed 5/27** | **Bike Z2 endurance — 90min, ~35km** | ${wxLine('2026-05-27')} |
| **Thu 5/28** | **Bike Club Ride — 1:30pm, ~110min** | ${wxLine('2026-05-28')} |
| **Fri 5/29** | **Tempo Run (10/20/15) — 45min** | ${wxLine('2026-05-29')} |
| **Sat 5/30** | **Rest / mobility** (Al Hertz bday) | ${wxLine('2026-05-30')} |
| **Sun 5/31** | **Long Run Z2 — 70min, ~11km** | ${wxLine('2026-05-31')} |

## Weekly load
~3h running (3 sessions) + ~3.5h riding (2 sessions) + 45min strength + 20min walk = ~7.5h. Two quality (Wed solo endurance ride, Fri tempo). Two genuinely social (Thu bike club, Sat birthday).

## Notes
- Reshuffled per request: Mon run → Tue strength → Wed bike → Thu bike (group) → Fri tempo.
- Wed bike kept at endurance only since Thu is back-to-back; if Wed weather is bad, swap to indoor trainer.
`;
await sql`UPDATE training_plans SET plan_content = ${newContent}, updated_at = NOW() WHERE id = ${plan.id}`;

console.log('\n=== UPDATED ACTIVITIES ===');
const verify = await sql`
  SELECT scheduled_date, activity_type, title, intensity, duration
  FROM training_plan_activities WHERE plan_id = ${plan.id} ORDER BY scheduled_date`;
console.log(JSON.stringify(verify, null, 2));
