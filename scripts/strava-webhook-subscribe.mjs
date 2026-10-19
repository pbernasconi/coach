#!/usr/bin/env node
/**
 * Registers (or shows) the Strava webhook subscription. Strava allows one per app.
 *
 *   node --env-file=.env.local scripts/strava-webhook-subscribe.mjs https://coach-paolo.vercel.app
 *
 * Needs STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_WEBHOOK_VERIFY_TOKEN (the same value as on Vercel).
 */

const base = process.argv[2];
const { STRAVA_CLIENT_ID: id, STRAVA_CLIENT_SECRET: secret, STRAVA_WEBHOOK_VERIFY_TOKEN: verify } = process.env;
if (!base || !id || !secret || !verify) {
  console.error('Usage: strava-webhook-subscribe.mjs <https origin>; set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN');
  process.exit(1);
}
const api = 'https://www.strava.com/api/v3/push_subscriptions';
const existing = await (await fetch(`${api}?client_id=${id}&client_secret=${secret}`)).json();
const callback = `${base.replace(/\/$/, '')}/api/webhooks/strava`;
if (Array.isArray(existing) && existing.length) {
  const sub = existing[0];
  if (sub.callback_url === callback) {
    console.log(`Already subscribed: id ${sub.id} -> ${sub.callback_url}`);
    process.exit(0);
  }
  console.log(`Replacing subscription ${sub.id} (${sub.callback_url})`);
  await fetch(`${api}/${sub.id}?client_id=${id}&client_secret=${secret}`, { method: 'DELETE' });
}
const body = new URLSearchParams({ client_id: id, client_secret: secret, callback_url: callback, verify_token: verify });
const res = await fetch(api, { method: 'POST', body });
const text = await res.text();
if (!res.ok) {
  console.error(`Subscription failed (${res.status}): ${text}`);
  process.exit(1);
}
console.log(`Subscribed: ${text}`);
