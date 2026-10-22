"""Tests for activities.py. Run: python3 -m unittest"""

import unittest
from datetime import datetime, timezone

import activities


def call(label, fn, *args, optional=False):
    return fn(*args)


class FakeApi:
    def __init__(self):
        self.calls = []

    def get_activities(self, start, limit):
        self.calls.append("list")
        return [
            {"activityId": 111, "startTimeGMT": "2026-10-22 18:45:12", "activityType": {"typeKey": "running"},
             "aerobicTrainingEffect": 3.1, "ownerDisplayName": "paolo", "ownerId": 42},
            {"activityId": 110, "startTimeGMT": "2026-10-21 14:00:00", "activityType": {"typeKey": "strength_training"}},
            {"activityId": 100, "startTimeGMT": "2026-10-10 14:00:00", "activityType": {"typeKey": "running"}},
        ]

    def get_activity(self, gid):
        self.calls.append(f"activity {gid}")
        return {"activityId": int(gid), "summaryDTO": {"trainingEffect": 3.1}, "userProfileId": 42}

    def get_activity_details(self, gid, maxchart, maxpoly):
        self.calls.append(f"details {gid} {maxchart} {maxpoly}")
        return {
            "metricDescriptors": [
                {"metricsIndex": 0, "key": "sumDuration"},
                {"metricsIndex": 1, "key": "directHeartRate"},
                {"metricsIndex": 2, "key": "directGroundContactTime"},
                {"metricsIndex": 3, "key": "directLatitude"},
                {"metricsIndex": 4, "key": "directPower"},
            ],
            "activityDetailMetrics": [
                {"metrics": [0.0, 120.0, 250.123456, 37.7, None]},
                {"metrics": [5.0, 130.0, 248.0, 37.7, None]},
            ],
        }


class FakeCoach:
    def __init__(self, have):
        self.have = have
        self.posted = []
        self.since = None

    def garmin_activity_ids(self, since):
        self.since = since
        return self.have

    def post_garmin_activities(self, batch):
        self.posted.extend(batch)


NOW = datetime(2026, 10, 22, 19, 50, tzinfo=timezone.utc)


class ActivitiesTest(unittest.TestCase):
    def test_start_utc(self):
        assert activities.start_utc({"startTimeGMT": "2026-10-22 18:45:12"}) == "2026-10-22T18:45:12Z"
        assert activities.start_utc({"startTimeGMT": ""}) is None
        assert activities.start_utc({}) is None

    def test_compact_series_keeps_known_keys_with_values(self):
        s = activities.compact_series(FakeApi().get_activity_details("1", 600, 0))
        assert s == {"t": [0.0, 5.0], "directHeartRate": [120.0, 130.0], "directGroundContactTime": [250.123, 248.0]}
        assert activities.compact_series({}) is None
        assert activities.compact_series(None) is None

    def test_sync_recent_stores_only_new_recent_activities_without_account_ids(self):
        api, coach = FakeApi(), FakeCoach(have=["110"])
        stored, failed = activities.sync_recent(api, coach, call, frozenset({42, "paolo"}), now=NOW)
        assert (stored, failed) == (1, 0)
        assert coach.since == "2026-10-20T19:50:00Z"
        assert api.calls == ["list", "activity 111", "details 111 600 0"]
        [a] = coach.posted
        assert a["id"] == "111" and a["startUtc"] == "2026-10-22T18:45:12Z" and a["type"] == "running"
        assert "ownerDisplayName" not in a["summary"] and "ownerId" not in a["summary"]
        assert "userProfileId" not in a["detail"]
        assert a["series"]["directHeartRate"] == [120.0, 130.0]

    def test_sync_recent_dry_run_posts_nothing(self):
        coach = FakeCoach(have=[])
        stored, _ = activities.sync_recent(FakeApi(), coach, call, now=NOW, dry_run=True)
        assert stored == 2 and coach.posted == []
