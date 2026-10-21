"""Unit tests for mapping.py and the offline parts of sync.py. Run: python3 -m unittest"""

from __future__ import annotations

import json
import unittest
from datetime import date
from pathlib import Path

import mapping

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str):
    return json.loads((FIXTURES / name).read_text())


def as_dict(samples):
    return {(s["date"], s["metric"]): s["value"] for s in samples}


class WearTest(unittest.TestCase):
    T = 1894633200000

    def hr(self, values):
        return {"heartRateValues": values}

    def test_worn_minutes_from_two_minute_points(self):
        rows = [[self.T + i * 120000, 50] for i in range(30)] + [[self.T + 31 * 120000, None]]
        self.assertEqual(mapping.wear_minutes(self.hr(rows), {}), 60)

    def test_no_points_means_not_worn(self):
        # A day without the watch: Garmin still says includesWellnessData true, with no heart rate.
        self.assertEqual(mapping.wear_minutes(self.hr([]), {"includesWellnessData": True}), 0)
        self.assertEqual(mapping.wear_minutes(self.hr(None), {}), 0)
        self.assertEqual(mapping.wear_minutes(self.hr([[self.T, None], [self.T + 120000, 0]]), {}), 0)

    def test_without_heart_rate_the_summary_decides(self):
        self.assertEqual(mapping.wear_minutes(None, {"includesWellnessData": False}), 0)
        self.assertIsNone(mapping.wear_minutes(None, {"includesWellnessData": True}))
        self.assertIsNone(mapping.wear_minutes(None, None))

    def test_fixture_and_map_day(self):
        hr = load("raw_heart_rates.json")
        got = as_dict(mapping.map_day("2030-01-15", {"heart_rates": hr}))
        n = sum(1 for r in hr["heartRateValues"] if r[1])
        self.assertEqual(got[("2030-01-15", "wear_min")], min(n * 2, 1440))
        self.assertEqual(as_dict(mapping.map_day("2030-01-15", {"heart_rates": {"heartRateValues": []}})), {("2030-01-15", "wear_min"): 0})


class MapDayTest(unittest.TestCase):
    def setUp(self):
        self.raw = {
            "summary": load("user_summary.json"),
            "hrv": load("hrv.json"),
            "sleep": load("sleep.json"),
            "readiness": load("training_readiness.json"),
            "max_metrics": load("max_metrics.json"),
        }

    def test_full_day(self):
        got = as_dict(mapping.map_day("2030-01-14", self.raw))
        d = "2030-01-14"
        self.assertEqual(
            got,
            {
                (d, "resting_hr_bpm"): 38,
                (d, "resting_hr_7d_avg_bpm"): 39,
                (d, "stress_avg"): 22,
                (d, "body_battery_high"): 70,
                (d, "body_battery_low"): 14,
                (d, "steps"): 9498,
                (d, "active_energy_kcal"): 587,
                (d, "hrv_night_avg_ms"): 46,
                (d, "hrv_weekly_avg_ms"): 50,
                (d, "hrv_baseline_low_ms"): 44,
                (d, "hrv_baseline_high_ms"): 56,
                (d, "hrv_status"): 4,
                (d, "sleep_total_min"): 335,
                (d, "sleep_deep_min"): 70,
                (d, "sleep_rem_min"): 79,
                (d, "sleep_core_min"): 186,
                (d, "sleep_awake_min"): 17,
                (d, "sleep_score"): 67,
                (d, "respiratory_rate"): 10.8,
                (d, "sleep_avg_stress"): 11.2,
                (d, "spo2_pct"): 92.7,
                (d, "training_readiness"): 62,
                (d, "readiness_hrv_factor"): 74,
                (d, "vo2max"): 43.7,
            },
        )

    def test_sample_shape(self):
        for s in mapping.map_day("2030-01-14", self.raw):
            self.assertEqual(set(s), {"date", "metric", "value", "unit", "source"})
            self.assertEqual(s["source"], "garmin")
            self.assertIn(s["metric"], mapping.METRIC_UNITS)
            self.assertEqual(s["unit"], mapping.METRIC_UNITS[s["metric"]])
            self.assertIsInstance(s["value"], (int, float))
            self.assertNotIsInstance(s["value"], bool)

    def test_metrics_are_unique_per_day(self):
        samples = mapping.map_day("2030-01-14", self.raw)
        keys = [(s["date"], s["metric"]) for s in samples]
        self.assertEqual(len(keys), len(set(keys)))

    def test_empty_day_skips_nulls_and_sentinels(self):
        raw = {
            "summary": load("user_summary_empty.json"),
            "hrv": None,
            "sleep": load("sleep_none.json"),
            "readiness": [],
            "max_metrics": [],
        }
        got = as_dict(mapping.map_day("2030-01-15", raw))
        # Only the 7-day RHR is set; stress -1 means "not enough data". No wellness data: the watch was not worn.
        self.assertEqual(got, {("2030-01-15", "resting_hr_7d_avg_bpm"): 39, ("2030-01-15", "wear_min"): 0})

    def test_all_missing(self):
        self.assertEqual(mapping.map_day("2030-01-15", {}), [])
        self.assertEqual(
            mapping.map_day("2030-01-15", {k: None for k in ("summary", "hrv", "sleep", "readiness", "max_metrics")}),
            [],
        )

    def test_privacy_protected_summary_is_ignored(self):
        got = mapping.map_day("2030-01-14", {"summary": {"privacyProtected": True, "totalSteps": 5}})
        self.assertEqual(got, [])

    def test_spo2_falls_back_to_sleep(self):
        summary = dict(self.raw["summary"], averageSpo2=None)
        got = as_dict(mapping.map_day("2030-01-14", {"summary": summary, "sleep": self.raw["sleep"]}))
        self.assertEqual(got[("2030-01-14", "spo2_pct")], 91.7)

    def test_readiness_without_input_context_uses_first(self):
        entries = [{"score": 70}, {"score": 40}]
        got = as_dict(mapping.map_day("2030-01-14", {"readiness": entries}))
        self.assertEqual(got, {("2030-01-14", "training_readiness"): 70})

    def test_hrv_status_codes(self):
        for status, code in [("NONE", 0), ("POOR", 1), ("LOW", 2), ("UNBALANCED", 3), ("balanced", 4)]:
            hrv = {"hrvSummary": {"status": status}}
            got = as_dict(mapping.map_day("2030-01-14", {"hrv": hrv}))
            self.assertEqual(got, {("2030-01-14", "hrv_status"): code}, status)
        got = mapping.map_day("2030-01-14", {"hrv": {"hrvSummary": {"status": "SOMETHING_NEW"}}})
        self.assertEqual(got, [])

    def test_vo2max_running_and_cycling_are_separate(self):
        mm = [{"generic": None, "cycling": {"vo2MaxPreciseValue": 58.25}}]
        got = as_dict(mapping.map_day("2030-01-14", {"max_metrics": mm}))
        self.assertEqual(got, {("2030-01-14", "vo2max_cycling"): 58.2}, "no running estimate: no vo2max")
        mm = [{"generic": {"vo2MaxPreciseValue": 50.44}, "cycling": {"vo2MaxValue": 51.0}}]
        got = as_dict(mapping.map_day("2030-01-14", {"max_metrics": mm}))
        self.assertEqual(got, {("2030-01-14", "vo2max"): 50.4, ("2030-01-14", "vo2max_cycling"): 51})

    def test_bad_types_are_skipped(self):
        raw = {
            "summary": {"restingHeartRate": "abc", "totalSteps": True, "averageStressLevel": float("nan")},
            "hrv": {"hrvSummary": "oops"},
            "sleep": {"dailySleepDTO": []},
            "readiness": "x",
            "max_metrics": 7,
        }
        self.assertEqual(mapping.map_day("2030-01-14", raw), [])

    def test_numeric_strings_are_accepted(self):
        got = as_dict(mapping.map_day("2030-01-14", {"summary": {"restingHeartRate": "51"}}))
        self.assertEqual(got, {("2030-01-14", "resting_hr_bpm"): 51})


class RealPayloadTest(unittest.TestCase):
    """The raw_<kind>.json fixtures: real Garmin responses (2030-01-15), redacted, lists cut to 60 items."""

    DAY = "2030-01-15"

    def raw(self, *kinds):
        return {k: load(f"raw_{k}.json") for k in kinds}

    def test_daily_kinds(self):
        raw = self.raw(*[k for k, _, _ in __import__("sync").DAILY_SOURCES])
        got = as_dict(mapping.map_day(self.DAY, raw))
        d = self.DAY
        expected = {
            "training_status": 5,  # PRODUCTIVE_9
            "training_load_acute": 354,
            "training_load_chronic": 221,
            "training_load_ratio": 1.6,
            "load_focus_anaerobic": 24,
            "load_focus_high_aerobic": 259,
            "load_focus_low_aerobic": 602,
            "endurance_score": 4816,
            "hill_score": 30,
            "race_pred_5k_s": 1082,
            "race_pred_marathon_s": 11844,
            "intensity_minutes_vigorous": 1,
            "floors_climbed": 30.3,
            "sleep_awake_count": 1,
            "readiness_sleep_factor": 34,
            "hrv_baseline_low_ms": 77,
            "vo2max_cycling": 40.8,
        }
        for metric, value in expected.items():
            self.assertEqual(got.get((d, metric)), value, metric)
        self.assertGreaterEqual(len(got), 45)
        for s in mapping.map_day(d, raw):
            self.assertIn(s["metric"], mapping.METRIC_UNITS)
            if s["metric"] in mapping.INTEGER_METRICS:
                self.assertIsInstance(s["value"], int, s["metric"])

    def test_morning_readiness_is_chosen(self):
        got = as_dict(mapping.map_day(self.DAY, self.raw("readiness")))
        entries = load("raw_readiness.json")
        morning = next(e for e in entries if e["inputContext"] == "AFTER_WAKEUP_RESET")
        self.assertEqual(got[(self.DAY, "training_readiness")], morning["score"])
        self.assertEqual(got[(self.DAY, "readiness_recovery_time_h")], round(morning["recoveryTime"] / 60, 1))

    def test_periodic_kinds(self):
        got = as_dict(mapping.map_periodic(self.DAY, self.raw("lactate_threshold", "cycling_ftp", "fitness_age")))
        self.assertEqual(got[("2030-01-10", "lactate_threshold_hr_bpm")], 134)
        self.assertEqual(got[("2030-01-10", "lactate_threshold_pace_s_per_km")], 360)  # 6:00 /km
        self.assertEqual(got[("2028-11-11", "cycling_ftp_w")], 191)
        self.assertEqual(got[(self.DAY, "fitness_age")], 23.5)

    def test_lactate_history(self):
        got = as_dict(mapping.map_lactate_history(load("raw_lactate_threshold_history.json")))
        self.assertEqual(got[("2029-12-03", "lactate_threshold_hr_bpm")], 137)
        self.assertEqual(got[("2030-01-10", "lactate_threshold_pace_s_per_km")], 360)
        self.assertEqual(len(got), 8)

    def test_old_training_status_is_ignored(self):
        ts = load("raw_training_status.json")
        self.assertNotIn(("2030-02-26", "training_status"), as_dict(mapping.map_day("2030-02-26", {"training_status": ts})))
        self.assertIn(("2030-01-18", "training_status"), as_dict(mapping.map_day("2030-01-18", {"training_status": ts})))

    def test_training_status_codes(self):
        code = mapping.training_status_code
        self.assertEqual(code({"trainingStatusFeedbackPhrase": "UNPRODUCTIVE_2"}), 4)
        self.assertEqual(code({"trainingStatusFeedbackPhrase": "PRODUCTIVE_9"}), 5)
        self.assertEqual(code({"trainingStatusFeedbackPhrase": "NO_STATUS"}), 0)
        self.assertEqual(code({"trainingStatusFeedbackPhrase": "PRODUCTIVE_1", "trainingPaused": True}), 9)
        self.assertIsNone(code({"trainingStatusFeedbackPhrase": "SOMETHING_NEW"}))
        self.assertIsNone(code({}))


class RedactTest(unittest.TestCase):
    def test_id_keys_go_at_any_depth(self):
        payload = {
            "userProfilePK": 1, "userProfilePk": 1, "userProfileId": 1, "userId": 1, "displayName": "p",
            "fullName": "P B", "ownerDisplayName": "p", "userDailySummaryId": 1, "emailAddress": "a@b.c",
            "deviceId": 7, "activityId": 8,
            "list": [{"userProfilePK": 1, "value": 3}], "nested": {"sleepNeed": {"userProfilePk": 1, "baseline": 480}},
        }
        self.assertEqual(
            mapping.redact(payload),
            {"deviceId": 7, "activityId": 8, "list": [{"value": 3}], "nested": {"sleepNeed": {"baseline": 480}}},
        )

    def test_identifier_values_go_too(self):
        payload = {"someNewIdField": 132, "other": "132", "name": "paolo_b", "keep": 133, "flag": True, "series": [[1, 132]]}
        got = mapping.redact(payload, frozenset({132, "132", "paolo_b"}))
        self.assertEqual(got, {"keep": 133, "flag": True, "series": [[1]]})

    def test_nul_is_removed(self):
        self.assertEqual(mapping.redact({"a": "x\x00y"}), {"a": "xy"})

    def test_raw_fixtures_have_no_ids(self):
        import re

        for f in FIXTURES.glob("raw_*.json"):
            text = f.read_text()
            self.assertIsNone(re.search(r'"(userProfilePK|userProfilePk|userProfileId|userId|userDailySummaryId|displayName|fullName)"', text), f.name)

    def test_is_empty(self):
        for v in (None, {}, [], ""):
            self.assertTrue(mapping.is_empty(v))
        for v in ({"a": 1}, [0], 0):
            self.assertFalse(mapping.is_empty(v))


class BodyCompositionTest(unittest.TestCase):
    def test_split_per_day(self):
        split = mapping.split_body_composition(load("body_composition.json"))
        self.assertEqual(sorted(split), ["2030-01-12", "2030-01-13"])
        self.assertEqual(len(split["2030-01-13"]["dateWeightList"]), 2)
        self.assertEqual(mapping.split_body_composition(None), {})

    def test_latest_weigh_in_per_day(self):
        got = as_dict(mapping.map_body_composition(load("body_composition.json")))
        self.assertEqual(
            got,
            {
                ("2030-01-12", "weight_kg"): 57.92,
                ("2030-01-12", "body_fat_pct"): 11.8,
                ("2030-01-13", "weight_kg"): 58.12,
                ("2030-01-13", "body_fat_pct"): 12.1,
            },
        )

    def test_empty(self):
        self.assertEqual(mapping.map_body_composition(None), [])
        self.assertEqual(mapping.map_body_composition({"dateWeightList": []}), [])
        self.assertEqual(mapping.map_body_composition({"dateWeightList": [{"weight": 70000}]}), [])


class SyncHelpersTest(unittest.TestCase):
    """Offline tests for sync.py. The garminconnect import is lazy, so these run without the venv."""

    def setUp(self):
        import sync

        self.sync = sync

    def test_date_window(self):
        self.assertEqual(
            self.sync.date_window(date(2029, 5, 28), 3),
            ["2029-05-26", "2029-05-27", "2029-05-28"],
        )

    def test_summarize_has_no_values(self):
        samples = mapping.map_day("2030-01-14", {"summary": load("user_summary.json")})
        text = self.sync.summarize(samples)
        self.assertIn("steps=1", text)
        self.assertNotIn("11873", text)


@unittest.skipUnless(__import__("importlib").util.find_spec("garminconnect"), "garminconnect not installed")
class FetcherTest(unittest.TestCase):
    def setUp(self):
        import garminconnect
        import sync

        self.gc = garminconnect
        self.sync = sync
        self.sleeps = []
        self.fetcher = sync.Fetcher(0.5, sleep=self.sleeps.append)

    def test_ok(self):
        self.assertEqual(self.fetcher.call("x", lambda d: {"d": d}, "2030-01-14"), {"d": "2030-01-14"})
        self.assertEqual((self.fetcher.ok, self.fetcher.failed), (1, 0))
        self.assertEqual(self.sleeps, [0.5])

    def test_rate_limit_then_ok(self):
        results = iter([self.gc.GarminConnectTooManyRequestsError("429"), {"ok": 1}])

        def fn():
            r = next(results)
            if isinstance(r, Exception):
                raise r
            return r

        with self.assertLogs("garmin-sync", level="WARNING"):
            self.assertEqual(self.fetcher.call("x", fn), {"ok": 1})
        self.assertEqual(self.sleeps, [0.5, 60, 0.5])

    def test_rate_limit_gives_up(self):
        def fn():
            raise self.gc.GarminConnectTooManyRequestsError("429")

        with self.assertLogs("garmin-sync", level="WARNING"):
            self.assertIsNone(self.fetcher.call("sleep", fn))
        self.assertEqual(self.fetcher.failed, 1)
        self.assertEqual(self.fetcher.failures["sleep"], 1)
        self.assertEqual([s for s in self.sleeps if s != 0.5], [60, 120, 240])

    def test_not_found_is_not_a_failure(self):
        def fn():
            raise self.gc.GarminConnectNotFoundError("404")

        self.assertIsNone(self.fetcher.call("hrv", fn))
        self.assertEqual((self.fetcher.ok, self.fetcher.failed), (1, 0))

    def test_other_error_is_contained(self):
        def fn():
            raise self.gc.GarminConnectConnectionError("500 with body 72kg")

        with self.assertLogs("garmin-sync", level="WARNING") as logs:
            self.assertIsNone(self.fetcher.call("summary", fn))
        self.assertNotIn("72kg", "".join(logs.output))
        self.assertEqual(self.fetcher.failed, 1)

    def test_auth_error_aborts(self):
        def fn():
            raise self.gc.GarminConnectAuthenticationError("401")

        with self.assertRaises(self.sync.AuthFailed):
            self.fetcher.call("summary", fn)

    def test_collect_with_fake_api(self):
        fixtures = {
            "get_user_summary": load("user_summary.json"),
            "get_hrv_data": load("hrv.json"),
            "get_sleep_data": load("sleep.json"),
            "get_training_readiness": load("training_readiness.json"),
            "get_max_metrics": load("max_metrics.json"),
        }

        class FakeApi:
            def __getattr__(self, name):
                if name in fixtures:
                    return lambda day: fixtures[name]
                if name.startswith("get_"):
                    return lambda *a: None  # the newer sources: no data
                raise AttributeError(name)

            def get_body_composition(self, start, end):
                return load("body_composition.json")

        samples = self.sync.collect(FakeApi(), ["2030-01-14"], self.fetcher)
        self.assertEqual(len(samples), 24 + 4)
        self.assertEqual(self.fetcher.ok, len(self.sync.DAILY_SOURCES) + 2)  # + weight + fitness age

    def test_library_has_the_methods(self):
        methods = [m for _, m, _ in self.sync.DAILY_SOURCES + self.sync.PERIODIC_SOURCES]
        methods += ["get_body_composition", "get_user_timezone", "get_fitness_age_details", "get_lactate_threshold"]
        for method in methods:
            self.assertTrue(callable(getattr(self.gc.Garmin, method, None)), method)

    def test_source_arguments_match_the_library(self):
        import inspect

        day = "2030-01-15"
        for kind, method, _ in self.sync.DAILY_SOURCES:
            inspect.signature(getattr(self.gc.Garmin, method)).bind(None, *self.sync.daily_args(kind, day))
        for kind, method, _ in self.sync.PERIODIC_SOURCES:
            inspect.signature(getattr(self.gc.Garmin, method)).bind(None, *self.sync.periodic_args(kind, day))


if __name__ == "__main__":
    unittest.main()
