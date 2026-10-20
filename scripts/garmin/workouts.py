"""Puts Coach's planned runs on the Garmin watch: structured workouts on the Garmin Connect calendar.

Coach builds each workout in Garmin's own JSON (src/lib/workouts/garmin.mjs) and says what to do
(GET /api/workouts/garmin): create, update or delete, for the next two weeks. This module does it with the
unofficial Garmin Connect API (garminconnect 0.3.19: upload_workout, update_workout, schedule_workout,
unschedule_workout, delete_workout, get_workout_by_id), reads each workout back to check that Garmin stored the
same steps, and reports to Coach (POST /api/workouts/garmin). The watch gets the calendar on its next sync.

It runs inside sync.py (same login and tokens): after each data sync, and alone with --workouts-only (the hourly
workflow run, and /plan on the Mac). docs/research/structured-workouts.md has the API notes and the risks.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

log = logging.getLogger("garmin.workouts")

SCHEDULE_ID_KEYS = ("workoutScheduleId", "scheduleId", "scheduledWorkoutId", "id")


def flat_steps(steps: list[dict[str, Any]] | None) -> list[tuple[Any, ...]]:
    """The executable steps, repeats expanded, as (step type, end condition, end value, target type, low, high)."""
    out: list[tuple[Any, ...]] = []
    for s in steps or []:
        if s.get("type") == "RepeatGroupDTO":
            inner = flat_steps(s.get("workoutSteps"))
            out.extend(inner * int(s.get("numberOfIterations") or 1))
            continue
        target = (s.get("targetType") or {}).get("workoutTargetTypeId")
        value = s.get("endConditionValue")
        out.append(
            (
                (s.get("stepType") or {}).get("stepTypeId"),
                (s.get("endCondition") or {}).get("conditionTypeId"),
                round(float(value)) if isinstance(value, int | float) else None,
                target,
                _num(s.get("targetValueOne")) if target != 1 else None,
                _num(s.get("targetValueTwo")) if target != 1 else None,
            )
        )
    return out


def _num(v: Any) -> float | None:
    return round(float(v), 2) if isinstance(v, int | float) else None


def steps_of(workout: dict[str, Any] | None) -> list[dict[str, Any]]:
    segments = (workout or {}).get("workoutSegments") or [{}]
    return segments[0].get("workoutSteps") or []


def compare(sent: dict[str, Any], stored: dict[str, Any]) -> str | None:
    """None when Garmin stored the steps Coach sent; else what differs (the library once stored HR as power)."""
    a, b = flat_steps(steps_of(sent)), flat_steps(steps_of(stored))
    if len(a) != len(b):
        return f"Garmin stored {len(b)} steps, Coach sent {len(a)}"
    for i, (x, y) in enumerate(zip(a, b, strict=True)):
        if x != y:
            return f"step {i + 1} differs: sent {x}, stored {y}"
    return None


def schedule_id(reply: Any) -> Any:
    if isinstance(reply, dict):
        for k in SCHEDULE_ID_KEYS:
            if reply.get(k):
                return reply[k]
    return None


def find_schedule(api: Any, workout_id: Any, day: str) -> Any:
    """The calendar entry of a workout on a day, from the schedule list (when the schedule reply has no id)."""
    try:
        items = api.get_scheduled_workouts_by_period(day, day) or []
    except Exception:  # noqa: BLE001 - only a fallback
        return None
    for item in items if isinstance(items, list) else []:
        wid = item.get("workoutId") or (item.get("workout") or {}).get("workoutId")
        if str(wid) == str(workout_id):
            return schedule_id(item)
    return None


def apply(api: Any, op: dict[str, Any], is_missing: Callable[[BaseException], bool]) -> dict[str, Any]:
    """Do one op. Returns the result for Coach; raises on a Garmin error (the caller reports it)."""
    remote = op.get("remote") or {}
    result: dict[str, Any] = {"activityId": op["activityId"], "op": op["op"], "hash": op.get("hash"), "remote": remote}

    if op["op"] == "delete":
        for fn, rid in ((api.unschedule_workout, remote.get("scheduleId")), (api.delete_workout, remote.get("workoutId"))):
            if rid:
                try:
                    fn(rid)
                except Exception as e:
                    if not is_missing(e):  # already gone on Garmin is fine
                        raise
        result["ok"] = True
        return result

    workout, day = op["workout"], op["date"]
    workout_id = remote.get("workoutId")
    if op["op"] == "update" and workout_id:
        try:
            api.update_workout(workout_id, workout)
        except Exception as e:
            if not is_missing(e):
                raise
            workout_id = None  # deleted on Garmin by hand: make it again
    if not workout_id:
        workout_id = (api.upload_workout(workout) or {}).get("workoutId")
        if not workout_id:
            raise RuntimeError("Garmin returned no workoutId")
        remote = {"workoutId": workout_id, "scheduleId": None, "date": None}

    sid = remote.get("scheduleId")
    if not sid or remote.get("date") != day:
        if sid:
            try:
                api.unschedule_workout(sid)
            except Exception as e:
                if not is_missing(e):
                    raise
        sid = schedule_id(api.schedule_workout(workout_id, day)) or find_schedule(api, workout_id, day)
    result["remote"] = {"workoutId": workout_id, "scheduleId": sid, "date": day}

    problem = compare(workout, api.get_workout_by_id(workout_id))
    if not sid:
        problem = "; ".join(p for p in (problem, "no schedule id: the workout may not be on the calendar") if p)
    result["ok"] = problem is None
    if problem:
        result["error"] = problem
    return result


def push(
    api: Any,
    coach: Any,
    after_call: Callable[[], None],
    is_missing: Callable[[BaseException], bool],
    dry_run: bool = False,
) -> tuple[int, list[str]]:
    """Gets the ops from Coach, does them, reports. Returns (ops done, errors). Never raises for one bad op."""
    plan = coach.get_workout_ops()
    ops = plan.get("ops") or []
    log.info("workouts %s → %s: %d to do", plan.get("from"), plan.get("to"), len(ops))
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    for op in ops:
        label = f"{op['op']} {op.get('date') or ''} {((op.get('workout') or {}).get('workoutName')) or op['activityId']}".strip()
        log.info("  %s", label)
        if dry_run:
            continue
        try:
            r = apply(api, op, is_missing)
        except Exception as e:  # noqa: BLE001 - report it per workout
            r = {"activityId": op["activityId"], "op": op["op"], "ok": False, "hash": op.get("hash"),
                 "remote": op.get("remote"), "error": f"{type(e).__name__}: {str(e)[:200]}"}
        after_call()
        if not r.get("ok"):
            errors.append(f"{label}: {r.get('error')}")
        results.append(r)
    if results:
        coach.post_workout_results(results)
    return len(results), errors
