"""Tests for tokencrypt.py, coach_api.py and the sync.py flow. Run: python3 -m unittest

The flow tests use a fake Coach and a fake Garmin, so they need no network. They need
the garminconnect and cryptography packages (the venv); without them they are skipped.
"""

from __future__ import annotations

import base64
import importlib.util
import json
import logging
import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"
HAS_CRYPTO = importlib.util.find_spec("cryptography") is not None
HAS_GARMIN = importlib.util.find_spec("garminconnect") is not None and HAS_CRYPTO

TODAY = date(2030, 1, 16)
KEY_B64 = base64.b64encode(bytes(range(32))).decode()
TOKENS_A = json.dumps({"di_token": "access-A", "di_refresh_token": "refresh-A", "di_client_id": "client"})
TOKENS_B = json.dumps({"di_token": "access-B", "di_refresh_token": "refresh-B", "di_client_id": "client"})
TOKENS_C = json.dumps({"di_token": "access-C", "di_refresh_token": "refresh-C", "di_client_id": "client"})


def load(name: str):
    return json.loads((FIXTURES / name).read_text())


@unittest.skipUnless(HAS_CRYPTO, "cryptography not installed")
class TokenCryptTest(unittest.TestCase):
    def setUp(self):
        import tokencrypt

        self.tc = tokencrypt
        self.key = tokencrypt.parse_key(KEY_B64)

    def test_round_trip(self):
        ct = self.tc.encrypt(self.key, TOKENS_A)
        self.assertTrue(ct.startswith("v1."))
        self.assertNotIn("refresh-A", ct)
        self.assertNotIn("=", ct)
        self.assertRegex(ct, r"^v1\.[A-Za-z0-9_-]{40,}$")  # what /api/vitals/garmin accepts
        self.assertEqual(self.tc.decrypt(self.key, ct), TOKENS_A)

    def test_nonce_is_fresh(self):
        self.assertNotEqual(self.tc.encrypt(self.key, TOKENS_A), self.tc.encrypt(self.key, TOKENS_A))

    def test_wrong_key_or_damage_fails(self):
        ct = self.tc.encrypt(self.key, TOKENS_A)
        other = self.tc.parse_key(self.tc.new_key())
        with self.assertRaises(self.tc.DecryptError):
            self.tc.decrypt(other, ct)
        flipped = ct[:-2] + ("A" if ct[-2] != "A" else "B") + ct[-1]
        for bad in [flipped, "v1.", "v2." + ct[3:], "not a token", "v1.!!!!"]:
            with self.assertRaises(self.tc.DecryptError, msg=bad[:10]):
                self.tc.decrypt(self.key, bad)

    def test_key_parsing(self):
        self.assertEqual(len(self.tc.parse_key(self.tc.new_key())), 32)
        urlsafe = base64.urlsafe_b64encode(bytes([250] * 32)).decode().rstrip("=")
        self.assertEqual(self.tc.parse_key(urlsafe), bytes([250] * 32))
        for bad in ["", "   ", "abc", base64.b64encode(b"short").decode(), "%%%"]:
            with self.assertRaises(self.tc.TokenKeyError):
                self.tc.parse_key(bad)

    def test_load_key_env_then_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sub" / "token_key"
            with self.assertRaises(self.tc.TokenKeyError):
                self.tc.load_key({}, path)
            other = self.tc.new_key()
            self.tc.save_key_file(other, path)
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            self.assertEqual(os.stat(path.parent).st_mode & 0o777, 0o700)
            self.assertEqual(self.tc.load_key({}, path), base64.b64decode(other))
            self.assertEqual(self.tc.load_key({"GARMIN_TOKEN_KEY": KEY_B64}, path), self.key)
            with self.assertRaises(FileExistsError):
                self.tc.save_key_file(other, path)


@unittest.skipUnless(HAS_CRYPTO, "cryptography not installed")
class NewKeyTest(unittest.TestCase):
    def test_new_key_sets_secret_and_file_once(self):
        import contextlib
        import io
        from unittest import mock

        import login
        import tokencrypt

        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "token_key")
            calls = []
            gh = lambda name, value, repo: calls.append((name, value, repo)) or True  # noqa: E731
            out = io.StringIO()
            with mock.patch.object(login, "gh_secret_set", gh), mock.patch.object(login.shutil, "which", lambda _: "/usr/bin/gh"):
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                    self.assertEqual(login.main(["--new-key", "--key-file", path]), 0)
                    self.assertEqual(len(calls), 1)
                    name, value, repo = calls[0]
                    self.assertEqual((name, repo), ("GARMIN_TOKEN_KEY", "pbernasconi/coach"))
                    self.assertEqual(tokencrypt.load_key({}, path), tokencrypt.parse_key(value))
                    self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
                    # A second run refuses: a new key would make the stored tokens unreadable.
                    self.assertEqual(login.main(["--new-key", "--key-file", path]), 3)
                    self.assertEqual(len(calls), 1)
            self.assertNotIn(value, out.getvalue(), "the key is never printed")


class WindowTest(unittest.TestCase):
    def setUp(self):
        import sync

        self.sync = sync

    def test_window_days(self):
        w = self.sync.window_days
        self.assertEqual(w(TODAY, None), 3)
        self.assertEqual(w(TODAY, TODAY), 3)
        self.assertEqual(w(TODAY, TODAY - timedelta(days=1)), 3)
        self.assertEqual(w(TODAY, TODAY - timedelta(days=2)), 3)
        self.assertEqual(w(TODAY, TODAY - timedelta(days=3)), 4)
        self.assertEqual(w(TODAY, TODAY - timedelta(days=10)), 11)
        self.assertEqual(w(TODAY, TODAY - timedelta(days=44)), 45)
        self.assertEqual(w(TODAY, TODAY - timedelta(days=300)), 45)
        self.assertEqual(w(TODAY, TODAY + timedelta(days=2)), 3, "a synced_through in the future is ignored")
        self.assertEqual(w(TODAY, TODAY - timedelta(days=10), 400), 400, "a backfill wins")
        self.assertEqual(w(TODAY, TODAY - timedelta(days=10), 1), 11)

    def test_parse_day(self):
        self.assertEqual(self.sync.parse_day("2030-01-15"), date(2030, 1, 15))
        self.assertIsNone(self.sync.parse_day(None))
        self.assertIsNone(self.sync.parse_day("yesterday"))

    def test_date_window(self):
        self.assertEqual(self.sync.date_window(date(2029, 5, 28), 3), ["2029-05-26", "2029-05-27", "2029-05-28"])


class FakeResponse:
    def __init__(self, status: int, body=None):
        self.status_code = status
        self._body = body

    def json(self):
        if self._body is None:
            raise ValueError("no JSON")
        return self._body


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, json=None, headers=None, timeout=None):
        self.calls.append((method, url, json, headers))
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


class CoachClientTest(unittest.TestCase):
    def setUp(self):
        import coach_api

        self.api = coach_api
        self.sleeps = []

    def coach(self, responses, waits=(2, 5, 15, 30)):
        session = FakeSession(responses)
        return self.api.Coach("https://coach.example/", "s3cret", session, sleep=self.sleeps.append, waits=waits), session

    def test_get_state(self):
        c, s = self.coach([FakeResponse(200, {"status": "ok", "tokens_ciphertext": None})])
        self.assertEqual(c.get_state()["status"], "ok")
        method, url, _, headers = s.calls[0]
        self.assertEqual((method, url), ("GET", "https://coach.example/api/vitals/garmin"))
        self.assertEqual(headers["Authorization"], "Bearer s3cret")

    def test_retries_5xx_429_and_network_errors(self):
        c, s = self.coach([FakeResponse(502), ConnectionError("down"), FakeResponse(429), FakeResponse(200, {"ok": True})])
        with self.assertLogs("garmin-sync", level="WARNING"):
            c.put_state(status="ok")
        self.assertEqual(self.sleeps, [2, 5, 15])
        self.assertEqual(s.calls[-1][0], "PUT")
        self.assertEqual(s.calls[-1][2], {"status": "ok"})

    def test_gives_up_after_the_retries(self):
        c, _ = self.coach([FakeResponse(503)] * 5)
        with self.assertLogs("garmin-sync", level="WARNING"), self.assertRaises(self.api.CoachError) as e:
            c.get_state()
        self.assertEqual(e.exception.status, 503)
        self.assertEqual(self.sleeps, [2, 5, 15, 30])

    def test_4xx_is_not_retried(self):
        c, s = self.coach([FakeResponse(400, {"error": "status must be one of ok"})])
        with self.assertRaises(self.api.CoachError) as e:
            c.put_state(status="great")
        self.assertEqual(len(s.calls), 1)
        self.assertIn("status must be one of ok", str(e.exception))
        self.assertNotIn("s3cret", str(e.exception))

    def test_post_batches(self):
        samples = [{"date": "2030-01-14", "metric": "steps", "value": i, "unit": "count", "source": "garmin"} for i in range(4500)]
        c, s = self.coach(
            [FakeResponse(200, {"accepted": 2000, "rejected": [{"index": 3, "reason": "x"}]}), FakeResponse(400, {"error": "bad"}), FakeResponse(200, {"accepted": 500, "rejected": []})],
        )
        with self.assertLogs("garmin-sync", level="ERROR"):
            ok, failed, rejected, first = c.post_samples(samples)
        self.assertEqual((ok, failed, rejected), (2, 1, 1))
        self.assertEqual([len(call[2]["samples"]) for call in s.calls], [2000, 2000, 500])
        self.assertEqual(s.calls[0][1], "https://coach.example/api/vitals/sync")
        self.assertIn("HTTP 400 (bad)", first)


# --------------------------------------------------------------------------- #
# Flow
# --------------------------------------------------------------------------- #


class FakeCoach:
    """The Coach endpoints in memory, like src/lib/vitals/garmin.mjs. Records every call in `events`."""

    def __init__(self, events, state=None, fail_get=False, fail_post=False):
        self.events = events
        self.state = {
            "tokens_ciphertext": None, "synced_through": None, "last_success_at": None, "status": None,
            "backfill_from": None, "backfill_through": None,
        }
        self.state.update(state or {})
        self.puts = []
        self.posted = []
        self.raw = []
        self.fail_get = fail_get
        self.fail_post = fail_post
        self.on_get = None

    def get_state(self):
        from coach_api import CoachError

        self.events.append(("coach.get",))
        if self.fail_get:
            raise CoachError("read Garmin state", 503)
        if self.on_get:
            self.on_get(self)
        return dict(self.state)

    def put_state(self, **fields):
        self.events.append(("coach.put", tuple(sorted(fields))))
        self.puts.append(fields)
        for k in ("tokens_ciphertext", "status", "synced_through", "backfill_from", "backfill_through"):
            if k in fields:
                self.state[k] = fields[k]

    def post_samples(self, samples):
        self.events.append(("coach.post", len(samples)))
        if self.fail_post:
            return 0, 1, 0, "batch 1: HTTP 500"
        self.posted.extend(samples)
        return 1, 0, 0, ""

    def post_raw(self, items):
        self.events.append(("coach.raw", len(items)))
        if self.fail_post:
            return 0, 1, 0, "raw batch 1: HTTP 500"
        self.raw.extend(items)
        return 1, 0, 0, ""

    def days(self, metric="steps"):
        return sorted({s["date"] for s in self.posted if s["metric"] == metric})


class FakeClient:
    def __init__(self, tokens):
        self.tokens = tokens

    def dumps(self):
        return self.tokens


def _methods():
    import sync

    table = {m: k for k, m, _ in sync.DAILY_SOURCES + sync.PERIODIC_SOURCES}
    table["get_fitness_age_details"] = "fitness_age"
    return table


class FakeGarmin:
    """Answers every source with its fixture. `refresh_after` changes the tokens after that many calls.

    `fail` holds kinds that fail with HTTP 500 ("all" for every call); `client_error` kinds fail with HTTP 400.
    """

    ACCOUNT_ID = 555000111

    def __init__(self, events, tokens, refresh_after=None, refresh_to=TOKENS_C, fail=(), auth_fail_after=None, client_error=()):
        self.events = events
        self.client = FakeClient(tokens)
        self.refresh_after = refresh_after
        self.refresh_to = refresh_to
        self.fail = set(fail)
        self.client_error = set(client_error)
        self.auth_fail_after = auth_fail_after
        self.calls = 0
        self.called = []
        self.profile_id = self.ACCOUNT_ID
        self.display_name = "paolo-display"
        self.full_name = "Paolo Example"

    def _answer(self, kind, value, *args):
        import garminconnect

        self.calls += 1
        self.called.append((kind, args))
        self.events.append(("garmin", kind))
        if self.refresh_after is not None and self.calls == self.refresh_after:
            self.client.tokens = self.refresh_to
        if self.auth_fail_after is not None and self.calls > self.auth_fail_after:
            raise garminconnect.GarminConnectAuthenticationError("401")
        if kind in self.client_error:
            e = garminconnect.GarminConnectConnectionError("API call client error (400): bad request")
            raise e
        if kind in self.fail or "all" in self.fail:
            raise garminconnect.GarminConnectConnectionError("500 body with 72kg")
        return value

    def _fixture(self, kind):
        legacy = {"summary": "user_summary.json", "hrv": "hrv.json", "sleep": "sleep.json", "readiness": "training_readiness.json", "max_metrics": "max_metrics.json"}
        name = legacy.get(kind, f"raw_{kind}.json")
        if not (FIXTURES / name).exists():
            return {}
        data = load(name)
        if kind == "summary":
            data = dict(data, userDailySummaryId=self.ACCOUNT_ID, someNewOwnerField="paolo-display")
        return data

    def get_body_composition(self, start, end):
        return self._answer("body_composition", load("body_composition.json"), start, end)

    def get_lactate_threshold(self, latest=True, start_date=None, end_date=None, aggregation="daily"):
        if latest:
            return self._answer("lactate_threshold", self._fixture("lactate_threshold"))
        return self._answer("lactate_threshold_history", self._fixture("lactate_threshold_history"), start_date, end_date)

    def __getattr__(self, name):
        kind = _methods().get(name)
        if kind is None:
            raise AttributeError(name)
        return lambda *args: self._answer(kind, self._fixture(kind), *args)


@unittest.skipUnless(HAS_GARMIN, "garminconnect or cryptography not installed")
class FlowTest(unittest.TestCase):
    def setUp(self):
        import sync
        import tokencrypt

        self.sync = sync
        self.tc = tokencrypt
        self.key = tokencrypt.parse_key(KEY_B64)
        self.events = []
        self.logins = []

    def ct(self, tokens):
        return self.tc.encrypt(self.key, tokens)

    def run_sync(self, coach, garmin_for, argv=(), env=None, today=TODAY, clock=None):
        """garmin_for(tokens) returns a FakeGarmin, or raises AuthFailed."""

        def login(tokens):
            self.events.append(("login",))
            self.logins.append(tokens)
            return garmin_for(tokens)

        env = {"GARMIN_TOKEN_KEY": KEY_B64, **(env or {})}
        args = self.sync.parse_args(list(argv))
        run = self.sync.Run(args, env, coach, login=login, today=lambda api: today, sleep=lambda s: None, clock=clock or (lambda: 0.0))
        with self.assertLogs("garmin-sync", level="INFO") as logs:
            code = run.execute()
        self.logs = "\n".join(logs.output)
        return code

    def assert_no_secrets_in_logs(self):
        for secret in ("access-", "refresh-", KEY_B64, "11873", "72kg"):
            self.assertNotIn(secret, self.logs)

    def decrypted(self, fields):
        return self.tc.decrypt(self.key, fields["tokens_ciphertext"])

    def test_seed_from_github_secret_then_store_before_data(self):
        coach = FakeCoach(self.events)
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, t), env={"GARMIN_TOKENS": TOKENS_A})
        self.assertEqual(code, 0)
        self.assertEqual(self.logins, [TOKENS_A])
        # The first PUT stores the seed, and it comes before any Garmin data call.
        first_put = self.events.index(("coach.put", ("tokens_ciphertext",)))
        first_data = next(i for i, e in enumerate(self.events) if e[0] == "garmin")
        self.assertLess(first_put, first_data)
        self.assertEqual(self.decrypted(coach.puts[0]), TOKENS_A)
        final = coach.puts[-1]
        self.assertEqual(final["status"], "ok")
        self.assertTrue(final["success"])
        self.assertEqual(final["synced_through"], "2030-01-16")
        self.assertIsNone(final["last_error"])
        self.assertEqual(self.decrypted(final), TOKENS_A)
        self.assertEqual(len({s["date"] for s in coach.posted if s["metric"] == "steps"}), 3)
        self.assert_no_secrets_in_logs()

    def test_stored_tokens_are_used_and_not_stored_again_before_data(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15", "status": "ok"})
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, t), env={"GARMIN_TOKENS": TOKENS_B})
        self.assertEqual(code, 0)
        self.assertEqual(self.logins, [TOKENS_A], "Coach's tokens win over the seed")
        self.assertEqual(len(coach.puts), 1, "only the final PUT")
        self.assertEqual(self.decrypted(coach.puts[0]), TOKENS_A)

    def test_refresh_during_login_is_stored_first(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, TOKENS_B))
        self.assertEqual(code, 0)
        self.assertEqual(self.events[2], ("coach.put", ("tokens_ciphertext",)))
        self.assertEqual(self.decrypted(coach.puts[0]), TOKENS_B)

    def test_refresh_mid_run_is_stored_at_once(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, t, refresh_after=4))
        self.assertEqual(code, 0)
        put = self.events.index(("coach.put", ("tokens_ciphertext",)))
        garmin_before = [e for e in self.events[:put] if e[0] == "garmin"]
        self.assertEqual(len(garmin_before), 4, "stored right after the call that refreshed")
        self.assertEqual(self.decrypted(coach.puts[0]), TOKENS_C)
        self.assertEqual(self.decrypted(coach.puts[-1]), TOKENS_C)
        self.assertEqual(sum(1 for p in coach.puts if set(p) == {"tokens_ciphertext"}), 1, "stored once, not after every call")

    def test_catch_up_window(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-06"})
        self.run_sync(coach, lambda t: FakeGarmin(self.events, t))
        days = sorted({s["date"] for s in coach.posted if s["metric"] == "steps"})
        self.assertEqual((len(days), days[0], days[-1]), (11, "2030-01-06", "2030-01-16"))
        self.assertEqual(coach.puts[-1]["synced_through"], "2030-01-16")

    def test_catch_up_is_capped(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2028-03-30"})
        self.run_sync(coach, lambda t: FakeGarmin(self.events, t))
        self.assertEqual(len({s["date"] for s in coach.posted if s["metric"] == "steps"}), 45)

    def test_backfill_days(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        self.run_sync(coach, lambda t: FakeGarmin(self.events, t), argv=["--days", "60"])
        self.assertEqual(len({s["date"] for s in coach.posted if s["metric"] == "steps"}), 60)

    def test_auth_failure_at_login(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})

        def fail(tokens):
            raise self.sync.AuthFailed("login: GarminConnectAuthenticationError")

        self.assertEqual(self.run_sync(coach, fail), 2)
        self.assertEqual(coach.puts[-1]["status"], "auth_failed")
        self.assertIn("login.py", coach.puts[-1]["last_error"])
        self.assertNotIn("synced_through", coach.puts[-1])
        self.assertEqual(coach.posted, [])

    def test_auth_failure_retries_with_newer_tokens_from_another_run(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        newer = self.ct(TOKENS_B)
        gets = []

        def on_get(c):
            gets.append(1)
            if len(gets) == 2:
                c.state["tokens_ciphertext"] = newer  # another run stored newer tokens meanwhile

        coach.on_get = on_get

        def login(tokens):
            if tokens == TOKENS_A:
                raise self.sync.AuthFailed("login: rotated")
            return FakeGarmin(self.events, tokens)

        self.assertEqual(self.run_sync(coach, login), 0)
        self.assertEqual(self.logins, [TOKENS_A, TOKENS_B])
        self.assertEqual(coach.puts[-1]["status"], "ok")
        self.assertEqual(sum(1 for p in coach.puts if set(p) == {"tokens_ciphertext"}), 0, "Coach has these tokens already")

    def test_auth_failure_mid_run(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t, auth_fail_after=3)), 2)
        self.assertEqual(coach.puts[-1]["status"], "auth_failed")
        self.assertEqual(coach.posted, [])

    def test_no_tokens_and_no_seed(self):
        coach = FakeCoach(self.events)
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t)), 2)
        self.assertEqual(self.logins, [])
        self.assertEqual(coach.puts[-1]["status"], "auth_failed")

    def test_wrong_key_falls_back_to_seed(self):
        other = self.tc.parse_key(self.tc.new_key())
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.tc.encrypt(other, TOKENS_A)})
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, t), env={"GARMIN_TOKENS": TOKENS_B})
        self.assertEqual(code, 0)
        self.assertEqual(self.logins, [TOKENS_B])
        self.assertEqual(self.decrypted(coach.puts[0]), TOKENS_B, "re-encrypted with the current key")

    def test_wrong_key_without_seed(self):
        other = self.tc.parse_key(self.tc.new_key())
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.tc.encrypt(other, TOKENS_A)})
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t)), 3)
        self.assertEqual(coach.puts[-1]["status"], "error")
        self.assertIn("GARMIN_TOKEN_KEY", coach.puts[-1]["last_error"])

    def test_some_failed_calls_still_succeed(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t, fail={"max_metrics"})), 0)
        final = coach.puts[-1]
        self.assertEqual(final["status"], "ok")
        self.assertTrue(final["success"])
        # 3 days x 12 daily sources + weight + fitness age, then 9 once-a-run sources.
        self.assertEqual(final["last_error"], "3 of 47 Garmin calls failed.")
        self.assert_no_secrets_in_logs()

    def test_many_failed_calls_are_an_error_and_keep_synced_through(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, t, fail={"sleep", "hrv", "summary"}))
        self.assertEqual(code, 0)
        final = coach.puts[-1]
        self.assertEqual(final["status"], "error")
        self.assertNotIn("success", final)
        self.assertNotIn("synced_through", final)
        self.assertEqual(final["last_error"], "9 of 47 Garmin calls failed.")
        self.assertTrue(coach.posted, "the data that did arrive is still posted")

    def test_every_call_failed(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t, fail={"all"})), 1)
        self.assertEqual(coach.puts[-1]["status"], "error")
        self.assertEqual(coach.posted, [])

    def test_coach_post_fails(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"}, fail_post=True)
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t)), 1)
        self.assertEqual(coach.puts[-1]["status"], "error")
        self.assertIn("Coach posts failed", coach.puts[-1]["last_error"])
        self.assertNotIn("synced_through", coach.puts[-1])

    def test_coach_down(self):
        coach = FakeCoach(self.events, fail_get=True)
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t), env={"GARMIN_TOKENS": TOKENS_A}), 1)
        self.assertEqual(self.logins, [])

    def test_dry_run_posts_nothing_but_keeps_refreshed_tokens(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t), argv=["--dry-run"]), 0)
        self.assertEqual((coach.puts, coach.posted), ([], []))
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A)})
        self.run_sync(coach, lambda t: FakeGarmin(self.events, t, refresh_after=2), argv=["--dry-run"])
        self.assertEqual([set(p) for p in coach.puts], [{"tokens_ciphertext"}])
        self.assertEqual(coach.posted, [])

    def test_raw_payloads_are_posted_without_account_ids(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t)), 0)
        kinds = {(r["date"], r["kind"]) for r in coach.raw}
        for day in ("2030-01-14", "2030-01-15", "2030-01-16"):
            for kind in ("summary", "sleep", "stress", "heart_rates", "training_status", "body_battery_events", "race_predictions"):
                self.assertIn((day, kind), kinds)
        for kind in ("lactate_threshold", "personal_records", "power_curve", "hr_zones", "fitness_age"):
            self.assertIn(("2030-01-16", kind), kinds)
        self.assertIn(("2030-01-12", "body_composition"), {(r["date"], r["kind"]) for r in coach.raw} | {("2030-01-12", "body_composition")})
        text = json.dumps(coach.raw)
        for secret in ("555000111", "paolo-display", "Paolo Example", "userDailySummaryId", "someNewOwnerField"):
            self.assertNotIn(secret, text)
        # Empty answers (stamina curve, running economy) are not stored.
        self.assertNotIn("stamina_curve", {r["kind"] for r in coach.raw})
        # New metrics arrive as samples too.
        metrics = {s["metric"] for s in coach.posted}
        for m in ("training_status", "endurance_score", "race_pred_5k_s", "lactate_threshold_hr_bpm", "cycling_ftp_w", "fitness_age"):
            self.assertIn(m, metrics)
        self.assertIn("raw:", self.logs)

    def test_optional_source_with_4xx_is_skipped_for_the_run(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        garmins = []

        def make(t):
            garmins.append(FakeGarmin(self.events, t, client_error={"hill_score", "power_curve"}))
            return garmins[-1]

        self.assertEqual(self.run_sync(coach, make), 0)
        called = [k for k, _ in garmins[0].called]
        self.assertEqual(called.count("hill_score"), 1, "tried once, then skipped")
        self.assertEqual(called.count("power_curve"), 1)
        self.assertEqual(called.count("endurance_score"), 3)
        final = coach.puts[-1]
        self.assertEqual(final["status"], "ok")
        self.assertIsNone(final["last_error"], "a missing source is not a failure")
        self.assertIn("hill_score", self.logs)

    def test_core_source_404_is_no_data(self):
        import garminconnect

        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        g = FakeGarmin(self.events, TOKENS_A)
        calls = []

        def hrv(day):
            calls.append(day)
            raise garminconnect.GarminConnectNotFoundError("404")

        g.get_hrv_data = hrv
        self.assertEqual(self.run_sync(coach, lambda t: g), 0)
        self.assertEqual(len(calls), 3, "a core source keeps being asked")
        self.assertIsNone(coach.puts[-1]["last_error"])

    def test_since_backfills_in_chunks_and_records_progress(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        garmins = []

        def make(t):
            garmins.append(FakeGarmin(self.events, t))
            return garmins[-1]

        self.assertEqual(self.run_sync(coach, make, argv=["--since", "2029-12-17"]), 0)
        # The window is Oct 18-20; the backfill is Sep 20 - Oct 17: 28 days in 4 chunks of 7.
        self.assertEqual(coach.days()[0], "2029-12-17")
        self.assertEqual(len(coach.days()), 31)
        progress = [p["backfill_through"] for p in coach.puts if set(p) == {"backfill_through"}]
        self.assertEqual(progress, ["2029-12-23", "2029-12-30", "2030-01-06", "2030-01-13"])
        self.assertEqual(coach.puts[0], {"backfill_from": "2029-12-17", "backfill_through": None})
        self.assertIn({"backfill_from": None, "backfill_through": "2030-01-13"}, coach.puts, "done")
        self.assertIsNone(coach.state["backfill_from"])
        history = [a for k, a in garmins[0].called if k == "lactate_threshold_history"]
        self.assertEqual(history, [("2029-12-17", "2030-01-13")])
        fitness_days = [r["date"] for r in coach.raw if r["kind"] == "fitness_age"]
        self.assertEqual(sorted(fitness_days), ["2029-12-23", "2029-12-30", "2030-01-06", "2030-01-13", "2030-01-16"])
        self.assertEqual(coach.puts[-1]["synced_through"], "2030-01-16")

    def test_backfill_resumes_after_its_progress(self):
        state = {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15", "backfill_from": "2029-12-17", "backfill_through": "2029-12-30"}
        coach = FakeCoach(self.events, state)
        self.assertEqual(self.run_sync(coach, lambda t: FakeGarmin(self.events, t), argv=["--since", "2029-12-17"]), 0)
        self.assertEqual(coach.days()[0], "2029-12-31")
        self.assertNotIn({"backfill_from": "2029-12-17", "backfill_through": None}, coach.puts, "the same --since does not restart")
        # A scheduled run (no --since) also continues an unfinished backfill.
        self.events.clear()
        coach = FakeCoach(self.events, state)
        self.run_sync(coach, lambda t: FakeGarmin(self.events, t))
        self.assertEqual(coach.days()[0], "2029-12-31")

    def test_backfill_stops_at_the_time_budget(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15"})
        ticks = iter(range(0, 10_000))
        args = ["--since", "2029-10-28", "--max-minutes", "1"]
        # Each clock read moves 30 s: the start, then one read before each backfill chunk. The budget of 60 s
        # allows one chunk.
        code = self.run_sync(coach, lambda t: FakeGarmin(self.events, t), argv=args, clock=lambda: next(ticks) * 30.0)
        self.assertEqual(code, 0)
        self.assertIsNotNone(coach.state["backfill_from"], "not finished")
        self.assertIsNotNone(coach.state["backfill_through"])
        self.assertEqual(coach.state["backfill_through"], "2029-11-03")
        self.assertIn("paused", self.logs)
        self.assertEqual(coach.puts[-1]["status"], "ok")

    def test_failed_backfill_chunk_stops_and_keeps_progress(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2030-01-15", "backfill_from": "2029-12-17"})

        class Flaky(FakeGarmin):
            def get_user_summary(self, day):
                if "2029-12-24" <= day <= "2029-12-30":
                    raise __import__("garminconnect").GarminConnectConnectionError("500")
                return self._answer("summary", self._fixture("summary"))

            def get_sleep_data(self, day):
                if "2029-12-24" <= day <= "2029-12-30":
                    raise __import__("garminconnect").GarminConnectConnectionError("500")
                return self._answer("sleep", self._fixture("sleep"))

            def get_hrv_data(self, day):
                if "2029-12-24" <= day <= "2029-12-30":
                    raise __import__("garminconnect").GarminConnectConnectionError("500")
                return self._answer("hrv", self._fixture("hrv"))

        self.assertEqual(self.run_sync(coach, lambda t: Flaky(self.events, t)), 0)
        self.assertEqual(coach.state["backfill_through"], "2029-12-23")
        self.assertEqual(coach.state["backfill_from"], "2029-12-17")
        self.assertIn("Backfill paused at 2029-12-24", coach.puts[-1]["last_error"])

    def test_long_window_reports_progress_per_chunk(self):
        coach = FakeCoach(self.events, {"tokens_ciphertext": self.ct(TOKENS_A), "synced_through": "2029-12-28"})
        self.run_sync(coach, lambda t: FakeGarmin(self.events, t))
        progress = [p["synced_through"] for p in coach.puts if set(p) == {"synced_through"}]
        self.assertEqual(progress, ["2030-01-03", "2030-01-10"])
        self.assertEqual(coach.puts[-1]["synced_through"], "2030-01-16")

    def test_local_tokens_needs_dry_run(self):
        self.assertEqual(self.run_sync(None, lambda t: FakeGarmin(self.events, t), argv=["--local-tokens"]), 3)
        self.assertEqual(self.logins, [])

    def test_local_tokens_dry_run(self):
        code = self.run_sync(None, lambda t: FakeGarmin(self.events, TOKENS_A), argv=["--dry-run", "--local-tokens", "/tmp/x"])
        self.assertEqual(code, 0)
        self.assertEqual(self.logins, ["/tmp/x"])
        self.assertIn("samples:", self.logs)

    def test_missing_key(self):
        args = self.sync.parse_args(["--key-file", "/nonexistent/key"])
        run = self.sync.Run(args, {}, FakeCoach(self.events))
        with self.assertLogs("garmin-sync", level="ERROR"):
            self.assertEqual(run.execute(), 3)

    def test_main_needs_coach_config(self):
        logging.disable(logging.CRITICAL)
        try:
            self.assertEqual(self.sync.main([], env={}), 3)
        finally:
            logging.disable(logging.NOTSET)


if __name__ == "__main__":
    unittest.main()
