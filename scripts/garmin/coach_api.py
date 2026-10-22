"""The Coach endpoints that the Garmin job uses, with retries.

GET/PUT /api/vitals/garmin   the job's state: encrypted tokens, synced_through, status
POST    /api/vitals/sync     the samples, in batches of at most 2000
GET/POST /api/vitals/garmin/activities   the watch's activities (activities.py)

Network errors, 429 and 5xx are retried with backoff. Every call is idempotent
(the server upserts), so a retry is safe. Logs show status codes, never bodies.
"""

from __future__ import annotations

import contextlib
import logging
import time
from typing import Any, Callable

BATCH_SIZE = 2000
# /api/vitals/garmin/raw refuses bodies over 4 MB (Vercel's limit is 4.5 MB).
RAW_MAX_BYTES = 3_500_000
RAW_MAX_ITEMS = 500
RETRY_WAITS_S = (2, 5, 15, 30)

log = logging.getLogger("garmin-sync")


class CoachError(Exception):
    """Coach refused the request (4xx) or stayed down after the retries."""

    def __init__(self, what: str, status: int | None, error: str = "") -> None:
        self.status = status
        self.error = error
        super().__init__(f"{what}: {'HTTP ' + str(status) if status else 'no response'}{' (' + error + ')' if error else ''}")


def _error_of(r: Any) -> str:
    """The endpoint's "error" string if it sends one. Never the full body."""
    with contextlib.suppress(Exception):
        err = r.json().get("error")
        if isinstance(err, str):
            return err[:200]
    return ""


class Coach:
    def __init__(
        self,
        url: str,
        secret: str,
        session: Any = None,
        sleep: Callable[[float], None] = time.sleep,
        waits: tuple[float, ...] = RETRY_WAITS_S,
    ) -> None:
        if session is None:
            import requests

            session = requests.Session()
        self.base = url.rstrip("/")
        self.secret = secret
        self.session = session
        self.sleep = sleep
        self.waits = waits

    def _request(self, method: str, path: str, what: str, body: Any = None) -> Any:
        waits = list(self.waits)
        while True:
            status: int | None = None
            error = ""
            try:
                r = self.session.request(
                    method,
                    self.base + path,
                    json=body,
                    headers={"Authorization": f"Bearer {self.secret}"},
                    timeout=120,
                )
                status = r.status_code
                if 200 <= status < 300:
                    try:
                        return r.json()
                    except ValueError:
                        return None
                error = _error_of(r)
                retryable = status == 429 or status >= 500
            except Exception as e:  # noqa: BLE001 - network errors of any kind
                error = type(e).__name__
                retryable = True
            if not retryable or not waits:
                raise CoachError(what, status, error)
            wait = waits.pop(0)
            log.warning("%s: %s, retrying in %ss", what, f"HTTP {status}" if status else error, wait)
            self.sleep(wait)

    def get_state(self) -> dict[str, Any]:
        data = self._request("GET", "/api/vitals/garmin", "read Garmin state")
        return data if isinstance(data, dict) else {}

    def get_workout_ops(self) -> dict[str, Any]:
        """GET /api/workouts/garmin: the planned runs to create, update or delete on Garmin Connect."""
        data = self._request("GET", "/api/workouts/garmin", "read workout ops")
        return data if isinstance(data, dict) else {}

    def post_workout_results(self, results: list[dict[str, Any]]) -> None:
        """POST /api/workouts/garmin: what the workout push did."""
        self._request("POST", "/api/workouts/garmin", "store workout results", {"results": results})

    def garmin_activity_ids(self, since_iso: str) -> list[str]:
        """GET /api/vitals/garmin/activities: the ids of the Garmin activities Coach has that started after since_iso."""
        from urllib.parse import quote

        data = self._request("GET", f"/api/vitals/garmin/activities?since={quote(since_iso)}", "read Garmin activity ids")
        ids = data.get("ids") if isinstance(data, dict) else None
        return [str(i) for i in ids] if isinstance(ids, list) else []

    def post_garmin_activities(self, activities: list[dict[str, Any]]) -> None:
        """POST /api/vitals/garmin/activities, a few at a time (each is up to about 100 KB)."""
        for start in range(0, len(activities), 5):
            self._request("POST", "/api/vitals/garmin/activities", "store Garmin activities", {"activities": activities[start : start + 5]})

    def put_state(self, **fields: Any) -> None:
        """PUT /api/vitals/garmin. Only the given fields change."""
        self._request("PUT", "/api/vitals/garmin", "store Garmin state", fields)

    def post_samples(self, samples: list[dict[str, Any]]) -> tuple[int, int, int, str]:
        """Returns (batches ok, batches failed, samples rejected, first error)."""
        ok = failed = rejected = 0
        first_error = ""
        for start in range(0, len(samples), BATCH_SIZE):
            n = start // BATCH_SIZE + 1
            try:
                resp = self._request("POST", "/api/vitals/sync", f"batch {n}", {"samples": samples[start : start + BATCH_SIZE]})
                ok += 1
                if isinstance(resp, dict) and isinstance(resp.get("rejected"), list):
                    rejected += len(resp["rejected"])
            except CoachError as e:
                failed += 1
                first_error = first_error or str(e)
                log.error("%s", e)
        return ok, failed, rejected, first_error

    def post_raw(self, items: list[dict[str, Any]]) -> tuple[int, int, int, str]:
        """POST raw payloads in batches under RAW_MAX_BYTES. Returns (batches ok, batches failed, items rejected, first error).

        A single payload too big for one request is skipped and counted as rejected.
        """
        import json

        ok = failed = rejected = 0
        first_error = ""
        batch: list[dict[str, Any]] = []
        size = 2

        def send() -> None:
            nonlocal ok, failed, rejected, first_error, batch, size
            if not batch:
                return
            try:
                resp = self._request("POST", "/api/vitals/garmin/raw", f"raw batch {ok + failed + 1}", {"items": batch})
                ok += 1
                if isinstance(resp, dict) and isinstance(resp.get("rejected"), list):
                    rejected += len(resp["rejected"])
            except CoachError as e:
                failed += 1
                first_error = first_error or str(e)
                log.error("%s", e)
            batch, size = [], 2

        for item in items:
            n = len(json.dumps(item, separators=(",", ":"))) + 1
            if n > RAW_MAX_BYTES:
                rejected += 1
                log.warning("raw %s for %s is %d bytes, too big to send; skipped", item.get("kind"), item.get("date"), n)
                continue
            if batch and (size + n > RAW_MAX_BYTES or len(batch) >= RAW_MAX_ITEMS):
                send()
            batch.append(item)
            size += n
        send()
        return ok, failed, rejected, first_error
