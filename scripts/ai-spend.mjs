#!/usr/bin/env node
// What Coach's Claude API calls cost, from the ai_usage ledger (DATABASE.md, "What Claude costs"): this month by
// feature and model, the last 14 days, and the last 6 months.
//
//   node --env-file=.env.local scripts/ai-spend.mjs
import { connect } from '../src/db/neon.mjs';

const sql = connect();
const usd = (n) => `$${Number(n).toFixed(2)}`;

const byFeature = await sql`
  SELECT feature, model, COUNT(*)::int AS calls, SUM(cost_usd)::float AS usd,
    ROUND(AVG(cost_usd)::numeric, 4)::float AS per_call, SUM(input_tokens + cache_read_tokens + cache_write_tokens)::bigint AS input,
    SUM(output_tokens)::bigint AS output
  FROM ai_usage WHERE created_at >= date_trunc('month', NOW())
  GROUP BY feature, model ORDER BY usd DESC`;
console.log('This month');
console.table(byFeature.map((r) => ({ ...r, usd: usd(r.usd), per_call: usd(r.per_call) })));

const byDay = await sql`
  SELECT created_at::date AS day, COUNT(*)::int AS calls, SUM(cost_usd)::float AS usd
  FROM ai_usage WHERE created_at >= NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1`;
console.log('Last 14 days');
console.table(byDay.map((r) => ({ day: new Date(r.day).toISOString().slice(0, 10), calls: r.calls, usd: usd(r.usd) })));

const byMonth = await sql`
  SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, feature, SUM(cost_usd)::float AS usd
  FROM ai_usage WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '5 months' GROUP BY 1, 2 ORDER BY 1, 2`;
console.log('By month');
console.table(byMonth.map((r) => ({ ...r, usd: usd(r.usd) })));
