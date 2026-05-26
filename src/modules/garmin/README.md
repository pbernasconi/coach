# Garmin Connect Integration

**Status: BLOCKED on external API approval.**

## Why we want this

Garmin Connect gives recovery + readiness data that Strava doesn't:
- **HRV Status** — overnight HRV trend (autonomic recovery)
- **Body Battery** — composite energy score (0-100)
- **Training Status** — productive / maintaining / overreaching / unproductive / recovery
- **VO2 max** estimate
- **Lactate threshold** estimate (pace + HR)
- **Sleep stages + sleep score**
- **Stress level** (HR-based, all-day)
- **Resting HR trend**

Layered onto our Strava-driven CTL/ATL/TSB, this turns "are you fatigued?" from a load-based proxy into a true autonomic-state read.

## What's blocked

Garmin requires approval to use their API:

1. Apply at https://developer.garmin.com/health-api/overview/
2. Choose **Health API** (for HRV, sleep, etc.) or **Activity API** (for workouts — partly overlaps with Strava).
3. Approval takes ~2 weeks. They review use case and require a privacy policy URL.

Once approved, you get:
- OAuth 1.0a credentials (consumer key + secret)
- Webhook push endpoints (Garmin pushes new data to you)

## What to build once unblocked

```
src/modules/garmin/
  garmin-types.ts          # API response shapes
  garmin-service.ts        # OAuth + API client
  garmin-persister.ts      # DB ops
  garmin-routes.ts         # Webhook receiver
  garmin-controller.ts     # Route handlers
```

New schema additions:
- `garmin_connections` (OAuth tokens, like strava_connections)
- `garmin_daily_summary` (HRV status, body battery, training status, resting HR per day)
- `garmin_sleep` (sleep stages, score, duration per night)

Wire `garmin_daily_summary` into the `coach-profile.mjs` aggregator so the fitness state surfaces:
- Sleep score last night
- HRV trend (7-day baseline vs current)
- Body Battery at wake-up

Then `/plan` and `/check-in` can use this for true recovery-informed decisions.

## Alternative if Garmin approval is slow

**HRV4Training Pro API** — works with Apple Health (or Garmin) data, has a developer API, much faster onboarding.
