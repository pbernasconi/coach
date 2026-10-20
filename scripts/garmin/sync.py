#!/usr/bin/env python3
"""Pull Garmin Connect data and push it to Coach.

Usage:
  python sync.py                       # catch-up window (at least 3 days, see below)
  python sync.py --since 2025-04-20    # backfill from that day; resumable
  python sync.py --days 60             # a bigger window this run only (not resumable)
  python sync.py --dry-run             # fetch and map; print counts and sizes; post nothing
  python sync.py --dry-run --local-tokens   # the same with ~/.garminconnect, no Coach at all

What goes where:
  POST /api/vitals/sync         the mapped daily metrics (mapping.py → health_samples)
  POST /api/vitals/garmin/raw   every Garmin response, without account ids (garmin_raw)
  GET/PUT /api/vitals/garmin    the job's state: encrypted tokens, progress, status

The Garmin tokens live in Coach, encrypted with AES-256-GCM (tokencrypt.py). When
Coach has no tokens yet, the job takes them from GARMIN_TOKENS (the old GitHub secret)
and stores them encrypted. When Garmin refreshes the tokens, the job stores the new
ones at once.

The window: max(--days, days since synced_through + 1), with the catch-up part capped
at 45 days, so missed runs fill themselves in. A backfill (--since) is stored in Coach
(backfill_from, backfill_through). Every run continues an unfinished backfill after its
window, chunk by chunk, until --max-minutes is used up. So an interrupted backfill
continues by itself.

Environment:
  COACH_URL          for example https://coach.paolobernasconi.com
  CRON_SECRET        bearer token for the Coach endpoints
  GARMIN_TOKEN_KEY   32 bytes, base64 (else ~/.garminconnect/token_key)
  GARMIN_TOKENS      optional seed: token JSON from login.py --github-secret

The job never prints health values or tokens. Exit codes: 0 ok (some failed calls
are fine), 1 every request failed or Coach is down, 2 Garmin auth failed, 3 bad
configuration.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import logging
import os
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

import mapping
import tokencrypt
from coach_api import Coach, CoachError

DEFAULT_DAYS = 3
CATCH_UP_MAX_DAYS = 45
MAX_DAYS = 1500
CHUNK_DAYS = 7
DEFAULT_DELAY_S = 1.0
DEFAULT_MAX_MINUTES = 50.0
RATE_LIMIT_WAITS_S = (60, 120, 240)
# A chunk with more failed Garmin calls than this is an "error": its days are fetched again later.
MAX_FAILED_SHARE = 0.2
# Garmin's range endpoints accept at most a year.
MAX_RANGE_DAYS = 365

EXIT_OK, EXIT_FAILED, EXIT_AUTH, EXIT_CONFIG = 0, 1, 2, 3

log = logging.getLogger("garmin-sync")


class AuthFailed(Exception):
    pass


# --------------------------------------------------------------------------- #
# Sources
# --------------------------------------------------------------------------- #

# (kind, garminconnect method, optional). Each is called once per day with the day.
# A core source treats HTTP 404 as "no data that day". An optional source that fails
# with any 4xx is skipped for the rest of the run (some accounts or devices lack it).
DAILY_SOURCES: list[tuple[str, str, bool]] = [
    ("summary", "get_user_summary", False),
    ("hrv", "get_hrv_data", False),
    ("sleep", "get_sleep_data", False),
    ("readiness", "get_training_readiness", False),  # also the morning readiness (AFTER_WAKEUP_RESET)
    ("max_metrics", "get_max_metrics", False),  # also heat and altitude acclimation
    ("heart_rates", "get_heart_rates", True),
    ("stress", "get_stress_data", True),  # stress and Body Battery timelines
    ("training_status", "get_training_status", True),  # also the 4-week load balance and VO2max feedback
    ("endurance_score", "get_endurance_score", True),
    ("hill_score", "get_hill_score", True),
    ("race_predictions", "get_race_predictions", True),
    ("body_battery_events", "get_body_battery_events", True),
]

# Once a run, stored under the run's day. (kind, method, optional)
PERIODIC_SOURCES: list[tuple[str, str, bool]] = [
    ("lactate_threshold", "get_lactate_threshold", True),
    ("cycling_ftp", "get_cycling_ftp", True),
    ("personal_records", "get_personal_record", True),
    ("power_curve", "get_power_curve", True),
    ("stamina_curve", "get_stamina_curve", True),
    ("running_economy", "get_running_economy", True),
    ("running_tolerance", "get_running_tolerance", True),
    ("hr_zones", "get_heart_rate_zones_v2", True),
    ("power_zones", "get_power_zones", True),
]


def daily_args(kind: str, day: str) -> tuple[Any, ...]:
    if kind == "race_predictions":
        return (day, day, "daily")
    return (day,)


def periodic_args(kind: str, day: str) -> tuple[Any, ...]:
    d = date.fromisoformat(day)
    if kind == "power_curve":
        return ((d - timedelta(days=89)).isoformat(), day, "cycling")
    if kind == "running_tolerance":
        return ((d - timedelta(days=27)).isoformat(), day, "daily")
    if kind in ("stamina_curve", "running_economy"):
        return (day,)
    return ()


# --------------------------------------------------------------------------- #
# Garmin access
# --------------------------------------------------------------------------- #


def garmin_login(source: str) -> Any:
    """Log in with token JSON or a token dir. Never asks for a password: no email/password are set."""
    import garminconnect

    api = garminconnect.Garmin()
    try:
        api.login(source)
    except Exception as e:  # noqa: BLE001 - every login failure is an auth failure here
        raise AuthFailed(f"login: {type(e).__name__}") from None
    return api


def same_tokens(a: str | None, b: str | None) -> bool:
    if a is None or b is None:
        return a == b
    try:
        return json.loads(a) == json.loads(b)
    except ValueError:
        return a == b


class TokenKeeper:
    """Stores the Garmin tokens in Coach, encrypted, each time they change."""

    def __init__(self, api: Any, coach: Coach | None, key: bytes | None, stored: str | None) -> None:
        self.api = api
        self.coach = coach
        self.key = key
        self.stored = stored  # the plaintext that Coach has now (None: nothing, or a seed)

    def current(self) -> str:
        return self.api.client.dumps()

    def changed(self) -> bool:
        return not same_tokens(self.current(), self.stored)

    def ciphertext(self) -> str:
        assert self.key is not None
        return tokencrypt.encrypt(self.key, self.current())

    def save_if_changed(self) -> bool:
        """PUT the tokens when they differ from what Coach has. Raises CoachError."""
        if self.coach is None or not self.changed():
            return False
        now = self.current()
        self.coach.put_state(tokens_ciphertext=tokencrypt.encrypt(self.key, now))  # type: ignore[arg-type]
        self.stored = now
        log.info("stored the new Garmin tokens in Coach (encrypted)")
        return True

    def after_call(self) -> None:
        """Called after each Garmin call: the library refreshes the session when it nears expiry."""
        try:
            self.save_if_changed()
        except CoachError as e:
            # Not fatal here: the next call and the final PUT try again.
            log.error("could not store refreshed tokens yet: %s", e)


def http_status(e: BaseException) -> int | None:
    status = getattr(getattr(e, "response", None), "status_code", None)
    if isinstance(status, int):
        return status
    m = re.search(r"\((\d{3})\)", str(e))
    return int(m.group(1)) if m else None


class Fetcher:
    """Calls one Garmin method with a delay, 429 backoff and per-call error capture."""

    def __init__(
        self,
        delay_s: float,
        sleep: Callable[[float], None] = time.sleep,
        after_call: Callable[[], None] | None = None,
    ) -> None:
        self.delay_s = delay_s
        self.sleep = sleep
        self.after_call = after_call
        self.ok = 0
        self.failed = 0
        self.failures: Counter[str] = Counter()
        self.skipped: set[str] = set()  # optional sources this account does not have

    def call(self, label: str, fn: Callable[..., Any], *args: Any, optional: bool = False) -> Any:
        if label in self.skipped:
            return None
        try:
            return self._call(label, fn, *args, optional=optional)
        finally:
            if self.after_call:
                self.after_call()

    def _call(self, label: str, fn: Callable[..., Any], *args: Any, optional: bool) -> Any:
        import garminconnect

        waits = list(RATE_LIMIT_WAITS_S)
        while True:
            self.sleep(self.delay_s)
            try:
                result = fn(*args)
                self.ok += 1
                return result
            except garminconnect.GarminConnectAuthenticationError:
                raise AuthFailed(f"{label}: Garmin rejected the tokens") from None
            except garminconnect.GarminConnectTooManyRequestsError:
                if not waits:
                    return self._fail(label, "rate limited")
                wait = waits.pop(0)
                log.warning("%s: rate limited, waiting %ss", label, wait)
                self.sleep(wait)
            except Exception as e:  # noqa: BLE001 - one bad call must not stop the run
                status = http_status(e)
                if optional and status is not None and 400 <= status < 500:
                    self.skipped.add(label)
                    self.ok += 1
                    log.info("%s: HTTP %s, so this account does not have it; skipped for this run", label, status)
                    return None
                if isinstance(e, garminconnect.GarminConnectNotFoundError):
                    self.ok += 1  # no data for that day; not a failure
                    return None
                return self._fail(label, f"HTTP {status}" if status else type(e).__name__)

    def _fail(self, label: str, reason: str) -> None:
        self.failed += 1
        self.failures[label] += 1
        log.warning("%s failed (%s)", label, reason)
        return None


# --------------------------------------------------------------------------- #
# Fetch and map
# --------------------------------------------------------------------------- #


def account_identifiers(api: Any) -> frozenset[Any]:
    """The account's profile id, display name and full name, as the library read them at login."""
    values: set[Any] = set()
    for attr in ("profile_id", "display_name", "full_name", "username"):
        v = getattr(api, attr, None)
        if isinstance(v, (int, str)) and not isinstance(v, bool) and str(v).strip():
            values.add(v)
            if isinstance(v, int):
                values.add(str(v))
    return frozenset(values)


@dataclass
class Batch:
    """What a chunk of days produced."""

    identifiers: frozenset[Any] = frozenset()
    samples: list[dict[str, Any]] = field(default_factory=list)
    raw: list[dict[str, Any]] = field(default_factory=list)  # {date, kind, payload}
    calls: int = 0
    failed: int = 0

    def add_raw(self, day: str, kind: str, payload: Any) -> None:
        if not mapping.is_empty(payload):
            self.raw.append({"date": day, "kind": kind, "payload": mapping.redact(payload, self.identifiers)})


def fetch_days(api: Any, days: list[str], fetcher: Fetcher) -> Batch:
    """The daily sources for each day, weight for the range, fitness age for the last day."""
    start_ok, start_failed = fetcher.ok, fetcher.failed
    b = Batch(account_identifiers(api))
    for day in days:
        raw: dict[str, Any] = {}
        for kind, method, optional in DAILY_SOURCES:
            raw[kind] = fetcher.call(kind, getattr(api, method), *daily_args(kind, day), optional=optional)
            b.add_raw(day, kind, raw[kind])
        b.samples.extend(mapping.map_day(day, raw))
    body = fetcher.call("body_composition", api.get_body_composition, days[0], days[-1])
    b.samples.extend(mapping.map_body_composition(body))
    for day, payload in mapping.split_body_composition(body).items():
        b.add_raw(day, "body_composition", payload)
    # Fitness age takes a date: one point a chunk (a week) builds its history in a backfill.
    fa = fetcher.call("fitness_age", api.get_fitness_age_details, days[-1], optional=True)
    b.add_raw(days[-1], "fitness_age", fa)
    b.samples.extend(mapping.map_fitness_age(days[-1], fa))
    b.calls = fetcher.ok + fetcher.failed - start_ok - start_failed
    b.failed = fetcher.failed - start_failed
    return b


def fetch_periodic(api: Any, day: str, fetcher: Fetcher) -> Batch:
    start_ok, start_failed = fetcher.ok, fetcher.failed
    b = Batch(account_identifiers(api))
    raw: dict[str, Any] = {}
    for kind, method, optional in PERIODIC_SOURCES:
        raw[kind] = fetcher.call(kind, getattr(api, method), *periodic_args(kind, day), optional=optional)
        b.add_raw(day, kind, raw[kind])
    b.samples.extend(mapping.map_periodic(day, raw))
    b.calls = fetcher.ok + fetcher.failed - start_ok - start_failed
    b.failed = fetcher.failed - start_failed
    return b


def fetch_lactate_history(api: Any, first: str, last: str, fetcher: Fetcher) -> Batch:
    """Lactate threshold changes over a backfill range, in pieces of at most a year."""
    b = Batch(account_identifiers(api))
    start = date.fromisoformat(first)
    end = date.fromisoformat(last)
    while start <= end:
        piece_end = min(end, start + timedelta(days=MAX_RANGE_DAYS - 1))
        h = fetcher.call(
            "lactate_threshold_history",
            lambda s, e: api.get_lactate_threshold(latest=False, start_date=s, end_date=e, aggregation="daily"),
            start.isoformat(),
            piece_end.isoformat(),
            optional=True,
        )
        b.add_raw(piece_end.isoformat(), "lactate_threshold_history", h)
        b.samples.extend(mapping.map_lactate_history(h))
        start = piece_end + timedelta(days=1)
    return b


def collect(api: Any, days: list[str], fetcher: Fetcher) -> list[dict[str, Any]]:
    """The samples for `days` (tests and simple callers)."""
    return fetch_days(api, days, fetcher).samples


# --------------------------------------------------------------------------- #
# Window
# --------------------------------------------------------------------------- #


def parse_day(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def window_days(today: date, synced_through: date | None, requested: int = DEFAULT_DAYS) -> int:
    """max(requested, days since synced_through + 1), the catch-up part capped at 45."""
    catch_up = 0
    if synced_through is not None and synced_through <= today:
        catch_up = min((today - synced_through).days + 1, CATCH_UP_MAX_DAYS)
    return max(requested, catch_up)


def date_window(end: date, days: int) -> list[str]:
    return [(end - timedelta(days=n)).isoformat() for n in range(days - 1, -1, -1)]


def day_range(first: date, last: date) -> list[str]:
    return [(first + timedelta(days=n)).isoformat() for n in range((last - first).days + 1)]


def chunks(days: list[str], size: int = CHUNK_DAYS) -> list[list[str]]:
    return [days[i : i + size] for i in range(0, len(days), size)]


def backfill_days(state: dict[str, Any], window_start: date) -> list[str]:
    """The days an unfinished backfill still needs: from max(backfill_from, backfill_through + 1) to the window."""
    first = parse_day(state.get("backfill_from"))
    if first is None:
        return []
    through = parse_day(state.get("backfill_through"))
    if through is not None and through >= first:
        first = through + timedelta(days=1)
    last = window_start - timedelta(days=1)
    return day_range(first, last) if first <= last else []


def garmin_today(api: Any) -> date:
    """Garmin files data under the profile's local date, not the runner's UTC date."""
    tz_name = None
    with contextlib.suppress(Exception):
        tz_name = api.get_user_timezone()
    if tz_name:
        with contextlib.suppress(Exception):
            from zoneinfo import ZoneInfo

            return datetime.now(ZoneInfo(tz_name)).date()
    return datetime.now(timezone.utc).date()


def summarize(samples: list[dict[str, Any]]) -> str:
    by_metric = Counter(s["metric"] for s in samples)
    return ", ".join(f"{m}={n}" for m, n in sorted(by_metric.items())) or "none"


def raw_bytes(item: dict[str, Any]) -> int:
    return len(json.dumps(item["payload"], separators=(",", ":")))


# --------------------------------------------------------------------------- #
# Run
# --------------------------------------------------------------------------- #


@dataclass
class Totals:
    calls: int = 0
    failed: int = 0
    samples: Counter[str] = field(default_factory=Counter)
    raw_items: int = 0
    raw_bytes: Counter[str] = field(default_factory=Counter)
    raw_days: set[str] = field(default_factory=set)
    rejected: int = 0
    posts_ok: int = 0
    post_errors: list[str] = field(default_factory=list)

    def add(self, b: Batch) -> None:
        self.calls += b.calls
        self.failed += b.failed
        self.samples.update(s["metric"] for s in b.samples)
        self.raw_items += len(b.raw)
        for item in b.raw:
            self.raw_bytes[item["kind"]] += raw_bytes(item)
            self.raw_days.add(item["date"])


class Run:
    """One sync. Garmin login, the clock and sleep are injected, so tests can fake them."""

    def __init__(
        self,
        args: argparse.Namespace,
        env: dict[str, str],
        coach: Coach | None,
        login: Callable[[str], Any] = garmin_login,
        today: Callable[[Any], date] = garmin_today,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.args = args
        self.env = env
        self.coach = coach
        self.login = login
        self.today = today
        self.sleep = sleep
        self.clock = clock
        self.started = clock()
        self.totals = Totals()

    # ---- reporting -------------------------------------------------------- #

    def report(self, **fields: Any) -> bool:
        """PUT the run's state. Never in a dry run. Failure to report is logged, not raised."""
        if self.args.dry_run or self.coach is None:
            return True
        try:
            self.coach.put_state(**fields)
            return True
        except CoachError as e:
            log.error("could not report to Coach: %s", e)
            return False

    def fail_auth(self, why: str) -> int:
        log.error("Garmin auth failed (%s). Run scripts/garmin/login.py again.", why)
        self.report(status="auth_failed", last_error=f"Garmin auth failed ({why}). Run login.py.")
        return EXIT_AUTH

    def minutes_used(self) -> float:
        return (self.clock() - self.started) / 60

    # ---- tokens ----------------------------------------------------------- #

    def tokens_from_coach(self, state: dict[str, Any], key: bytes) -> tuple[str | None, str]:
        """(plaintext or None, where it came from). A seed from GARMIN_TOKENS is not yet in Coach."""
        ct = state.get("tokens_ciphertext")
        if isinstance(ct, str) and ct:
            try:
                return tokencrypt.decrypt(key, ct), "coach"
            except tokencrypt.DecryptError:
                log.error("cannot decrypt the tokens in Coach: GARMIN_TOKEN_KEY does not match")
        seed = self.env.get("GARMIN_TOKENS", "").strip()
        if seed:
            return seed, "seed"
        return None, "none"

    def retry_with_newer_tokens(self, key: bytes, before: dict[str, Any]) -> Any:
        try:
            state = self.coach.get_state()  # type: ignore[union-attr]
        except CoachError:
            return None
        ct = state.get("tokens_ciphertext")
        if not ct or ct == before.get("tokens_ciphertext"):
            return None
        try:
            newer = tokencrypt.decrypt(key, ct)
        except tokencrypt.DecryptError:
            return None
        log.info("Coach has newer tokens than this run read; trying them")
        try:
            return self.login(newer)
        except AuthFailed:
            return None

    # ---- main flow -------------------------------------------------------- #

    def execute(self) -> int:
        if self.args.local_tokens:
            return self.execute_local()
        assert self.coach is not None
        try:
            key = tokencrypt.load_key(self.env, self.args.key_file)
        except tokencrypt.TokenKeyError as e:
            log.error("%s", e)
            return EXIT_CONFIG
        try:
            state = self.coach.get_state()
        except CoachError as e:
            log.error("%s", e)
            return EXIT_FAILED

        tokens, origin = self.tokens_from_coach(state, key)
        if tokens is None:
            if state.get("tokens_ciphertext"):
                self.report(status="error", last_error="Cannot decrypt the stored tokens: GARMIN_TOKEN_KEY changed. Run login.py.")
                return EXIT_CONFIG
            return self.fail_auth("no tokens in Coach and no GARMIN_TOKENS seed")
        log.info("Garmin tokens from %s", "Coach" if origin == "coach" else "the GARMIN_TOKENS seed")

        try:
            api = self.login(tokens)
        except AuthFailed as e:
            # Another run (or login.py) can have stored newer tokens since we read them.
            api = self.retry_with_newer_tokens(key, state)
            if api is None:
                return self.fail_auth(str(e))
            tokens, origin = api.client.dumps(), "coach"

        keeper = TokenKeeper(api, self.coach, key, tokens if origin == "coach" else None)
        try:
            # A seed, or a refresh during login: store it before any data call.
            keeper.save_if_changed()
        except CoachError as e:
            log.error("%s", e)
            return EXIT_FAILED

        if getattr(self.args, "workouts_only", False):
            return self.workouts(api, keeper)
        today = self.today(api)
        if self.args.since:
            state = self.start_backfill(state, self.args.since, today)
        n = window_days(today, parse_day(state.get("synced_through")), self.args.days or DEFAULT_DAYS)
        code = self.sync(api, keeper, date_window(today, n), state)
        if code != EXIT_AUTH:
            self.workouts(api, keeper)  # its own trouble never fails the data sync
        return code

    def workouts(self, api: Any, keeper: TokenKeeper) -> int:
        """Puts Coach's planned runs on the Garmin calendar (workouts.py). Exit code for --workouts-only."""
        import workouts

        try:
            done, errors = workouts.push(
                api,
                self.coach,
                after_call=keeper.after_call,
                is_missing=lambda e: http_status(e) == 404,
                dry_run=self.args.dry_run,
            )
        except AuthFailed as e:
            return self.fail_auth(str(e))
        except CoachError as e:
            log.error("workouts: %s", e)
            return EXIT_FAILED
        except Exception as e:  # noqa: BLE001 - the data sync must not depend on this
            log.error("workouts: %s: %s", type(e).__name__, str(e)[:200])
            return EXIT_FAILED
        with contextlib.suppress(CoachError):
            keeper.save_if_changed()
        for err in errors:
            log.warning("workout: %s", err)
        log.info("workouts: %d done, %d with problems", done, len(errors))
        return EXIT_OK if not errors else EXIT_FAILED

    def start_backfill(self, state: dict[str, Any], since: date, today: date) -> dict[str, Any]:
        """Record the backfill in Coach. The same --since again resumes; a new one starts over."""
        state = dict(state)
        if parse_day(state.get("backfill_from")) == since:
            log.info("backfill from %s: resuming after %s", since, state.get("backfill_through") or "the start")
            return state
        if since > today:
            log.warning("--since is in the future; nothing to backfill")
            return state
        state["backfill_from"], state["backfill_through"] = since.isoformat(), None
        self.report(backfill_from=since.isoformat(), backfill_through=None)
        log.info("backfill from %s: started", since)
        return state

    def execute_local(self) -> int:
        if not self.args.dry_run:
            log.error("--local-tokens works only with --dry-run")
            return EXIT_CONFIG
        try:
            # With a token dir, the library writes refreshed tokens back to it.
            api = self.login(os.path.expanduser(self.args.local_tokens))
        except AuthFailed as e:
            log.error("Garmin auth failed (%s). Run login.py --keep-local.", e)
            return EXIT_AUTH
        keeper = TokenKeeper(api, None, None, None)
        today = self.today(api)
        state: dict[str, Any] = {}
        if self.args.since:
            state = {"backfill_from": self.args.since.isoformat()}
        return self.sync(api, keeper, date_window(today, self.args.days or DEFAULT_DAYS), state)

    def post(self, b: Batch) -> bool:
        """Post a chunk's samples and raw payloads. True when Coach stored all of it (always in a dry run)."""
        self.totals.add(b)
        if self.args.dry_run or self.coach is None:
            return True
        ok = True
        if b.samples:
            done, failed, rejected, err = self.coach.post_samples(b.samples)
            self.totals.posts_ok += done
            self.totals.rejected += rejected
            if failed:
                ok = False
                self.totals.post_errors.append(err)
        if b.raw:
            done, failed, rejected, err = self.coach.post_raw(b.raw)
            self.totals.posts_ok += done
            self.totals.rejected += rejected
            if failed:
                ok = False
                self.totals.post_errors.append(err)
        return ok

    def sync(self, api: Any, keeper: TokenKeeper, window: list[str], state: dict[str, Any]) -> int:
        fetcher = Fetcher(self.args.delay, sleep=self.sleep, after_call=keeper.after_call)
        try:
            return self._sync(api, keeper, window, state, fetcher)
        except AuthFailed as e:
            with contextlib.suppress(CoachError):
                keeper.save_if_changed()
            return self.fail_auth(str(e))

    def _sync(self, api: Any, keeper: TokenKeeper, window: list[str], state: dict[str, Any], fetcher: Fetcher) -> int:
        log.info("syncing %d days: %s to %s", len(window), window[0], window[-1])
        good_through: str | None = None
        window_ok = True
        parts = chunks(window)
        for i, part in enumerate(parts):
            b = fetch_days(api, part, fetcher)
            ok = self.post(b) and b.failed <= MAX_FAILED_SHARE * max(b.calls, 1)
            if ok and window_ok:
                good_through = part[-1]
                # Progress after each chunk, so a long catch-up that dies keeps what it did. The last chunk
                # reports with the run's final PUT.
                if i < len(parts) - 1:
                    self.report(synced_through=good_through)
            window_ok = window_ok and ok
        periodic = fetch_periodic(api, window[-1], fetcher)
        self.post(periodic)

        backfill_note = self.continue_backfill(api, state, date.fromisoformat(window[0]), fetcher)
        return self.finish(fetcher, keeper, window, window_ok, good_through, backfill_note)

    def continue_backfill(self, api: Any, state: dict[str, Any], window_start: date, fetcher: Fetcher) -> str | None:
        """Backfill chunks, oldest first, until done or out of time. Returns a note for last_error, or None."""
        todo = backfill_days(state, window_start)
        if not state.get("backfill_from"):
            return None
        if not todo:
            log.info("backfill from %s is complete", state["backfill_from"])
            self.report(backfill_from=None)
            return None
        log.info("backfill: %d days left, %s to %s", len(todo), todo[0], todo[-1])
        history = fetch_lactate_history(api, todo[0], todo[-1], fetcher)
        self.post(history)
        for part in chunks(todo):
            if self.minutes_used() >= self.args.max_minutes:
                log.info("backfill: paused after %.0f minutes; the next run continues from %s", self.minutes_used(), part[0])
                return None
            b = fetch_days(api, part, fetcher)
            if not (self.post(b) and b.failed <= MAX_FAILED_SHARE * max(b.calls, 1)):
                log.warning("backfill: chunk %s to %s failed; the next run tries it again", part[0], part[-1])
                return f"Backfill paused at {part[0]} after errors."
            self.report(backfill_through=part[-1])
            log.info("backfill: through %s", part[-1])
        log.info("backfill from %s is complete", state["backfill_from"])
        self.report(backfill_from=None, backfill_through=todo[-1])
        return None

    def finish(
        self,
        fetcher: Fetcher,
        keeper: TokenKeeper,
        window: list[str],
        window_ok: bool,
        good_through: str | None,
        backfill_note: str | None,
    ) -> int:
        t = self.totals
        log.info("garmin calls: %d ok, %d failed", fetcher.ok, fetcher.failed)
        if fetcher.failures:
            log.info("failures by call: %s", dict(fetcher.failures))
        if fetcher.skipped:
            log.info("not available for this account: %s", ", ".join(sorted(fetcher.skipped)))
        log.info("samples: %d (%s)", sum(t.samples.values()), ", ".join(f"{m}={n}" for m, n in sorted(t.samples.items())) or "none")
        days = max(len(t.raw_days), 1)
        total = sum(t.raw_bytes.values())
        log.info("raw: %d payloads, %d bytes, %d bytes per day over %d days", t.raw_items, total, total // days, len(t.raw_days))
        log.info("raw bytes by kind: %s", ", ".join(f"{k}={v}" for k, v in sorted(t.raw_bytes.items(), key=lambda kv: -kv[1])))

        # The final PUT carries the tokens too, so a refresh that the per-call save missed is stored.
        final_tokens: dict[str, Any] = {}
        if keeper.coach is not None and keeper.key is not None:
            final_tokens = {"tokens_ciphertext": keeper.ciphertext()}

        if self.args.dry_run:
            if keeper.coach is not None:
                try:
                    keeper.save_if_changed()
                except CoachError as e:
                    log.error("%s", e)
            log.info("dry run: nothing posted, no run state reported")
            return EXIT_OK if fetcher.ok else EXIT_FAILED

        calls = fetcher.ok + fetcher.failed
        if fetcher.ok == 0:
            self.report(status="error", last_error=f"All {calls} Garmin calls failed.", **final_tokens)
            return EXIT_FAILED

        problems = []
        if fetcher.failed:
            problems.append(f"{fetcher.failed} of {calls} Garmin calls failed")
        if t.rejected:
            problems.append(f"Coach rejected {t.rejected} items")
        if t.post_errors:
            problems.append(f"{len(t.post_errors)} Coach posts failed ({t.post_errors[0][:120]})")
        if backfill_note:
            problems.append(backfill_note.rstrip("."))
        message = "; ".join(problems) + "." if problems else None

        if window_ok:
            self.report(status="ok", success=True, synced_through=window[-1], last_error=message, **final_tokens)
            keeper.stored = keeper.current()
            return EXIT_OK
        fields: dict[str, Any] = {"status": "error", "last_error": message, **final_tokens}
        if good_through:
            fields["synced_through"] = good_through
        self.report(**fields)
        # Non-zero only when Coach stored nothing at all; partial trouble shows in Coach (status, last_error).
        return EXIT_FAILED if t.post_errors and t.posts_ok == 0 else EXIT_OK


def parse_since(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError("--since must be YYYY-MM-DD") from None


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=int, default=None, help=f"at least this many days, ending today (default {DEFAULT_DAYS})")
    p.add_argument("--since", type=parse_since, default=None, help="backfill from this day (YYYY-MM-DD); resumable")
    p.add_argument("--max-minutes", type=float, default=DEFAULT_MAX_MINUTES, help="stop starting backfill chunks after this")
    p.add_argument("--dry-run", action="store_true", help="fetch and map; print counts and sizes; post nothing")
    p.add_argument("--workouts-only", action="store_true", help="only put Coach's planned runs on the Garmin calendar")
    p.add_argument("--delay", type=float, default=DEFAULT_DELAY_S, help="seconds between Garmin calls")
    p.add_argument("--key-file", default=None, help="key file if GARMIN_TOKEN_KEY is unset (default ~/.garminconnect/token_key)")
    p.add_argument(
        "--local-tokens",
        nargs="?",
        const="~/.garminconnect",
        default=None,
        metavar="DIR",
        help="with --dry-run: use the local token dir (default ~/.garminconnect) and not Coach",
    )
    args = p.parse_args(argv)
    if args.days is not None and not 1 <= args.days <= MAX_DAYS:
        p.error(f"--days must be between 1 and {MAX_DAYS}")
    if args.since is not None and args.since < date(2000, 1, 1):
        p.error("--since must be 2000-01-01 or later")
    return args


def main(argv: list[str] | None = None, env: dict[str, str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    # The library logs at DEBUG only; keep it quiet in any case.
    logging.getLogger("garminconnect").setLevel(logging.WARNING)
    args = parse_args(argv)
    env = dict(os.environ) if env is None else env

    coach = None
    if not args.local_tokens:
        coach_url = env.get("COACH_URL", "").strip()
        secret = env.get("CRON_SECRET", "").strip()
        if not coach_url or not secret:
            log.error("COACH_URL and CRON_SECRET are required (or use --dry-run --local-tokens)")
            return EXIT_CONFIG
        coach = Coach(coach_url, secret)
    try:
        return Run(args, env, coach).execute()
    except Exception as e:  # noqa: BLE001 - report, then fail
        log.error("unexpected error: %s", type(e).__name__)
        if coach is not None and not args.dry_run:
            with contextlib.suppress(Exception):
                coach.put_state(status="error", last_error=f"Unexpected error in sync.py: {type(e).__name__}.")
        return EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())
