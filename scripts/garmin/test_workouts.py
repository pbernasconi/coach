"""Tests for workouts.py: the Garmin side of Coach's planned runs. Run: python3 -m unittest test_workouts"""

from __future__ import annotations

import unittest
from typing import Any

import workouts


def step(order: int, type_id: int, secs: int, target: int = 1, lo: float | None = None, hi: float | None = None) -> dict[str, Any]:
    s: dict[str, Any] = {
        "type": "ExecutableStepDTO", "stepOrder": order, "stepType": {"stepTypeId": type_id},
        "endCondition": {"conditionTypeId": 2}, "endConditionValue": secs, "targetType": {"workoutTargetTypeId": target},
    }
    if lo is not None:
        s.update(targetValueOne=lo, targetValueTwo=hi)
    return s


WORKOUT = {
    "workoutName": "Coach · Made-up run",
    "workoutSegments": [{"workoutSteps": [
        step(1, 1, 600, 4, 101, 121),
        {"type": "RepeatGroupDTO", "stepOrder": 2, "numberOfIterations": 4, "workoutSteps": [step(3, 3, 180), step(4, 4, 180, 4, 101, 121)]},
    ]}],
}


class NotFound(Exception):
    pass


class FakeGarmin:
    def __init__(self, stored: dict[str, Any] | None = None, schedule_reply: Any = None) -> None:
        self.calls: list[tuple[Any, ...]] = []
        self.stored = stored
        self.schedule_reply = {"workoutScheduleId": 77} if schedule_reply is None else schedule_reply
        self.missing: set[Any] = set()

    def upload_workout(self, w: dict[str, Any]) -> dict[str, Any]:
        self.calls.append(("upload",))
        self.stored = self.stored or w
        return {"workoutId": 5}

    def update_workout(self, wid: Any, w: dict[str, Any]) -> None:
        self.calls.append(("update", wid))
        if wid in self.missing:
            raise NotFound("(404)")
        self.stored = w

    def schedule_workout(self, wid: Any, day: str) -> Any:
        self.calls.append(("schedule", wid, day))
        return self.schedule_reply

    def unschedule_workout(self, sid: Any) -> None:
        self.calls.append(("unschedule", sid))
        if sid in self.missing:
            raise NotFound("(404)")

    def delete_workout(self, wid: Any) -> None:
        self.calls.append(("delete", wid))

    def get_workout_by_id(self, wid: Any) -> dict[str, Any]:
        return self.stored or {}

    def get_scheduled_workouts_by_period(self, a: str, b: str) -> list[dict[str, Any]]:
        return [{"workoutId": 5, "scheduleId": 88}]


missing = lambda e: isinstance(e, NotFound)  # noqa: E731


class ApplyTests(unittest.TestCase):
    def test_create_uploads_schedules_and_checks(self) -> None:
        g = FakeGarmin()
        r = workouts.apply(g, {"op": "create", "activityId": "a", "hash": "h", "date": "2026-10-23", "workout": WORKOUT}, missing)
        self.assertTrue(r["ok"])
        self.assertEqual(r["remote"], {"workoutId": 5, "scheduleId": 77, "date": "2026-10-23"})
        self.assertEqual(g.calls, [("upload",), ("schedule", 5, "2026-10-23")])

    def test_a_stored_workout_that_differs_is_an_error(self) -> None:
        wrong = {"workoutSegments": [{"workoutSteps": [step(1, 1, 600, 2, 101, 121)]}]}  # HR stored as power
        r = workouts.apply(FakeGarmin(stored=wrong), {"op": "create", "activityId": "a", "date": "2026-10-23", "workout": WORKOUT}, missing)
        self.assertFalse(r["ok"])
        self.assertIn("Garmin stored 1 steps, Coach sent 9", r["error"])

    def test_update_moves_the_schedule_when_the_day_changed(self) -> None:
        g = FakeGarmin()
        op = {"op": "update", "activityId": "a", "date": "2026-10-24", "workout": WORKOUT, "remote": {"workoutId": 5, "scheduleId": 77, "date": "2026-10-23"}}
        r = workouts.apply(g, op, missing)
        self.assertTrue(r["ok"])
        self.assertEqual(g.calls, [("update", 5), ("unschedule", 77), ("schedule", 5, "2026-10-24")])

    def test_update_keeps_the_schedule_on_the_same_day(self) -> None:
        g = FakeGarmin()
        op = {"op": "update", "activityId": "a", "date": "2026-10-23", "workout": WORKOUT, "remote": {"workoutId": 5, "scheduleId": 77, "date": "2026-10-23"}}
        workouts.apply(g, op, missing)
        self.assertEqual(g.calls, [("update", 5)])

    def test_update_of_a_workout_deleted_on_garmin_makes_it_again(self) -> None:
        g = FakeGarmin()
        g.missing = {9}
        op = {"op": "update", "activityId": "a", "date": "2026-10-23", "workout": WORKOUT, "remote": {"workoutId": 9, "scheduleId": None, "date": None}}
        r = workouts.apply(g, op, missing)
        self.assertEqual(r["remote"]["workoutId"], 5)
        self.assertEqual(g.calls, [("update", 9), ("upload",), ("schedule", 5, "2026-10-23")])

    def test_delete_ignores_what_is_already_gone(self) -> None:
        g = FakeGarmin()
        g.missing = {77}
        r = workouts.apply(g, {"op": "delete", "activityId": "a", "remote": {"workoutId": 5, "scheduleId": 77}}, missing)
        self.assertTrue(r["ok"])
        self.assertEqual(g.calls, [("unschedule", 77), ("delete", 5)])

    def test_schedule_id_from_the_calendar_when_the_reply_has_none(self) -> None:
        r = workouts.apply(FakeGarmin(schedule_reply={}), {"op": "create", "activityId": "a", "date": "2026-10-23", "workout": WORKOUT}, missing)
        self.assertEqual(r["remote"]["scheduleId"], 88)


class FakeCoach:
    def __init__(self, ops: list[dict[str, Any]]) -> None:
        self.ops = ops
        self.posted: list[dict[str, Any]] = []

    def get_workout_ops(self) -> dict[str, Any]:
        return {"from": "2026-10-20", "to": "2026-11-02", "ops": self.ops}

    def post_workout_results(self, results: list[dict[str, Any]]) -> None:
        self.posted = results


class PushTests(unittest.TestCase):
    def test_one_failure_is_reported_and_the_rest_go_on(self) -> None:
        class Broken(FakeGarmin):
            def upload_workout(self, w: dict[str, Any]) -> dict[str, Any]:
                raise RuntimeError("boom")

        coach = FakeCoach([
            {"op": "create", "activityId": "a", "hash": "h", "date": "2026-10-23", "workout": WORKOUT},
            {"op": "delete", "activityId": "b", "remote": {"workoutId": 1, "scheduleId": 2}},
        ])
        calls: list[int] = []
        done, errors = workouts.push(Broken(), coach, after_call=lambda: calls.append(1), is_missing=missing)
        self.assertEqual(done, 2)
        self.assertEqual(len(errors), 1)
        self.assertEqual([r["ok"] for r in coach.posted], [False, True])
        self.assertIn("RuntimeError: boom", coach.posted[0]["error"])
        self.assertEqual(len(calls), 2)

    def test_dry_run_does_nothing(self) -> None:
        coach = FakeCoach([{"op": "create", "activityId": "a", "date": "2026-10-23", "workout": WORKOUT}])
        g = FakeGarmin()
        self.assertEqual(workouts.push(g, coach, after_call=lambda: None, is_missing=missing, dry_run=True), (0, []))
        self.assertEqual(g.calls, [])
        self.assertEqual(coach.posted, [])


if __name__ == "__main__":
    unittest.main()
