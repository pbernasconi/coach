"""The watch's own record of recent workouts, for Coach's activity page (garmin_activities).

Strava carries the GPS, heart rate and pace, and Coach stores those from the Strava webhook in seconds. Garmin
Connect has what Strava does not: training effect, Garmin's training load, running dynamics (ground contact,
vertical oscillation and ratio, stride), stamina, respiration, Body Battery, performance condition. The Strava
webhook starts garmin.yml with `activities`, so this runs about a minute after each workout; every regular run
also catches up.

  GET  /api/vitals/garmin/activities?since=<ISO>   the Garmin activity ids Coach already has
  POST /api/vitals/garmin/activities               { activities: [{ id, startUtc, type, summary, detail, series }] }

Garmin calls: 1 for the list, 2 for each new activity (its summary page and its time series at 600 points).
Account identifiers are removed before anything leaves the job (mapping.redact). Logs show counts, never values.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import mapping

log = logging.getLogger("garmin-sync")

LIST_SIZE = 20
LOOKBACK_HOURS = 48
SERIES_POINTS = 600
# The time series Coach keeps (Garmin's metric keys); the time axis is sumDuration.
SERIES_KEYS = (
    "directHeartRate",
    "directRunCadence",
    "directGroundContactTime",
    "directVerticalOscillation",
    "directVerticalRatio",
    "directStrideLength",
    "directPower",
    "directRespirationRate",
    "directPerformanceCondition",
    "directAvailableStamina",
    "directPotentialStamina",
    "directBodyBattery",
    "directGradeAdjustedSpeed",
)


def start_utc(item: dict[str, Any]) -> str | None:
    """Garmin's 'startTimeGMT' ('2026-10-22 18:45:12') as ISO UTC, or None."""
    raw = item.get("startTimeGMT")
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        dt = datetime.fromisoformat(raw.strip().replace(" ", "T").replace("Z", ""))
    except ValueError:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def type_key(item: dict[str, Any]) -> str | None:
    t = item.get("activityType") or item.get("activityTypeDTO") or {}
    key = t.get("typeKey") if isinstance(t, dict) else None
    return key if isinstance(key, str) else None


def compact_series(details: Any) -> dict[str, list[Any]] | None:
    """{ t: seconds[], <key>: values[] } for the SERIES_KEYS the activity has, or None."""
    if not isinstance(details, dict):
        return None
    descriptors = details.get("metricDescriptors")
    rows = details.get("activityDetailMetrics")
    if not isinstance(descriptors, list) or not isinstance(rows, list) or not rows:
        return None
    index = {d.get("key"): d.get("metricsIndex") for d in descriptors if isinstance(d, dict)}
    t_idx = index.get("sumDuration")
    if not isinstance(t_idx, int):
        return None

    def column(i: int) -> list[Any]:
        out = []
        for r in rows:
            m = r.get("metrics") if isinstance(r, dict) else None
            v = m[i] if isinstance(m, list) and i < len(m) else None
            out.append(round(v, 3) if isinstance(v, float) else v)
        return out

    series: dict[str, list[Any]] = {"t": column(t_idx)}
    for key in SERIES_KEYS:
        i = index.get(key)
        if isinstance(i, int):
            values = column(i)
            if any(v is not None for v in values):
                series[key] = values
    return series if len(series) > 1 else None


def sync_recent(
    api: Any,
    coach: Any,
    call: Callable[..., Any],
    identifiers: frozenset[Any] = frozenset(),
    now: datetime | None = None,
    dry_run: bool = False,
) -> tuple[int, int]:
    """Stores the activities of the last LOOKBACK_HOURS that Coach does not have. Returns (stored, failed).

    `call(label, fn, *args, optional=...)` is the job's Fetcher.call: retries, rate limits, token saving.
    """
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(hours=LOOKBACK_HOURS)
    listed = call("activities", api.get_activities, 0, LIST_SIZE) or []
    recent = []
    for item in listed if isinstance(listed, list) else []:
        start = start_utc(item) if isinstance(item, dict) else None
        if start and datetime.fromisoformat(start.replace("Z", "+00:00")) >= since and item.get("activityId"):
            recent.append((str(item["activityId"]), start, item))
    if not recent:
        log.info("activities: none in the last %d hours", LOOKBACK_HOURS)
        return 0, 0

    have: set[str] = set()
    if coach is not None:
        have = set(coach.garmin_activity_ids(since.isoformat().replace("+00:00", "Z")))
    stored = failed = 0
    batch = []
    for gid, start, item in recent:
        if gid in have:
            continue
        try:
            detail = call("activity", api.get_activity, gid, optional=True)
            details = call("activity_details", api.get_activity_details, gid, SERIES_POINTS, 0, optional=True)
        except Exception as e:  # noqa: BLE001 - one activity must not stop the others
            failed += 1
            log.warning("activity: %s", type(e).__name__)
            continue
        batch.append(
            {
                "id": gid,
                "startUtc": start,
                "type": type_key(item),
                "summary": mapping.redact(item, identifiers),
                "detail": mapping.redact(detail, identifiers) if isinstance(detail, dict) else None,
                "series": compact_series(details),
            }
        )
    if batch and not dry_run and coach is not None:
        coach.post_garmin_activities(batch)
    stored = len(batch)
    log.info("activities: %d new, %d already in Coach, %d failed", stored, len(recent) - stored - failed, failed)
    return stored, failed
