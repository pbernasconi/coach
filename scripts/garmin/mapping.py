"""Map raw Garmin Connect responses for one day to Coach vitals samples.

Pure functions only: no network, no logging. sync.py fetches the raw
responses and passes them here, so the tests can use fixture JSON.

Field names come from the garminconnect library (typed.py models and method
docstrings, version 0.3.19) and from Garmin Connect responses. Garmin does not
document these endpoints, so each value reads from a list of candidate keys.
"""

from __future__ import annotations

import math
from typing import Any, Iterable

SOURCE = "garmin"

# Closed set that /api/vitals/sync accepts. Keep in sync with the endpoint.
METRIC_UNITS: dict[str, str] = {
    "hrv_night_avg_ms": "ms",
    "hrv_weekly_avg_ms": "ms",
    "hrv_status": "code",
    "resting_hr_bpm": "bpm",
    "resting_hr_7d_avg_bpm": "bpm",
    "sleep_total_min": "min",
    "sleep_deep_min": "min",
    "sleep_rem_min": "min",
    "sleep_core_min": "min",
    "sleep_awake_min": "min",
    "sleep_score": "score",
    "body_battery_high": "score",
    "body_battery_low": "score",
    "stress_avg": "score",
    "training_readiness": "score",
    "vo2max": "mL/kg/min",
    "weight_kg": "kg",
    "body_fat_pct": "%",
    "respiratory_rate": "breaths/min",
    "spo2_pct": "%",
    "steps": "count",
    "active_energy_kcal": "kcal",
    "wrist_temp_delta_c": "degC",
    "sleep_avg_hr_bpm": "bpm",
    "sleep_avg_stress": "score",
    "sleep_awake_count": "count",
    "hrv_baseline_low_ms": "ms",
    "hrv_baseline_high_ms": "ms",
    "readiness_sleep_factor": "%",
    "readiness_hrv_factor": "%",
    "readiness_recovery_time_h": "h",
    "readiness_acute_load": "load",
    "intensity_minutes_moderate": "min",
    "intensity_minutes_vigorous": "min",
    "floors_climbed": "floors",
    "training_load_acute": "load",
    "training_load_chronic": "load",
    "training_load_ratio": "ratio",
    "load_focus_anaerobic": "load",
    "load_focus_high_aerobic": "load",
    "load_focus_low_aerobic": "load",
    "training_status": "code",
    "endurance_score": "score",
    "hill_score": "score",
    "race_pred_5k_s": "s",
    "race_pred_10k_s": "s",
    "race_pred_half_s": "s",
    "race_pred_marathon_s": "s",
    "lactate_threshold_hr_bpm": "bpm",
    "lactate_threshold_pace_s_per_km": "s/km",
    "cycling_ftp_w": "W",
    "fitness_age": "years",
    "vo2max_cycling": "mL/kg/min",
    "wear_min": "min",
}

# Metrics that the server stores as integers (metrics.mjs `integer: true`). The contract test checks this list.
INTEGER_METRICS: frozenset[str] = frozenset(
    {
        "hrv_status",
        "sleep_awake_count",
        "intensity_minutes_moderate",
        "intensity_minutes_vigorous",
        "training_status",
        "endurance_score",
        "hill_score",
        "wear_min",
    }
)

# Coach's training_status code, from Garmin's trainingStatusFeedbackPhrase ("PRODUCTIVE_9" → PRODUCTIVE).
# Garmin's own numeric trainingStatus is not documented, so the phrase is the source.
TRAINING_STATUS_CODES: dict[str, int] = {
    "NO_STATUS": 0,
    "DETRAINING": 1,
    "RECOVERY": 2,
    "MAINTAINING": 3,
    "UNPRODUCTIVE": 4,
    "PRODUCTIVE": 5,
    "PEAKING": 6,
    "OVERREACHING": 7,
    "STRAINED": 8,
    "PAUSED": 9,
}

# Garmin hrvSummary.status → Coach enum. 0 means "no status" (not enough data).
HRV_STATUS_CODES: dict[str, int] = {
    "NONE": 0,
    "POOR": 1,
    "LOW": 2,
    "UNBALANCED": 3,
    "BALANCED": 4,
}


def _get(obj: Any, path: str) -> Any:
    """Read a dotted path such as "dailySleepDTO.sleepScores.overall.value"."""
    for part in path.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _num(value: Any) -> float | None:
    """Return a finite number, or None. Booleans and strings that are not numbers give None."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, str):
        try:
            value = float(value)
        except ValueError:
            return None
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return value


def _first(obj: Any, paths: Iterable[str]) -> float | None:
    for path in paths:
        value = _num(_get(obj, path))
        if value is not None:
            return value
    return None


def _clean(value: float, digits: int = 1) -> float | int:
    rounded = round(float(value), digits)
    return int(rounded) if rounded.is_integer() else rounded


class _Collector:
    def __init__(self, date: str) -> None:
        self.date = date
        self.samples: list[dict[str, Any]] = []

    def add(
        self,
        metric: str,
        value: float | None,
        *,
        minimum: float | None = None,
        maximum: float | None = None,
        digits: int = 1,
    ) -> None:
        if value is None:
            return
        if minimum is not None and value < minimum:
            return
        if maximum is not None and value > maximum:
            return
        if metric in INTEGER_METRICS:
            digits = 0
        self.samples.append(
            {
                "date": self.date,
                "metric": metric,
                "value": _clean(value, digits),
                "unit": METRIC_UNITS[metric],
                "source": SOURCE,
            }
        )


def map_summary(c: _Collector, summary: Any) -> None:
    """get_user_summary(date) → RHR, stress, Body Battery, steps, energy, SpO2."""
    if not isinstance(summary, dict) or summary.get("privacyProtected") is True:
        return
    c.add("resting_hr_bpm", _first(summary, ["restingHeartRate"]), minimum=20, maximum=150)
    c.add(
        "resting_hr_7d_avg_bpm",
        _first(summary, ["lastSevenDaysAvgRestingHeartRate"]),
        minimum=20,
        maximum=150,
    )
    # Garmin uses -1 / -2 for "not enough data".
    c.add("stress_avg", _first(summary, ["averageStressLevel"]), minimum=0, maximum=100)
    c.add("body_battery_high", _first(summary, ["bodyBatteryHighestValue"]), minimum=0, maximum=100)
    c.add("body_battery_low", _first(summary, ["bodyBatteryLowestValue"]), minimum=0, maximum=100)
    c.add("steps", _first(summary, ["totalSteps"]), minimum=0, digits=0)
    c.add("active_energy_kcal", _first(summary, ["activeKilocalories"]), minimum=0, digits=0)
    c.add("intensity_minutes_moderate", _first(summary, ["moderateIntensityMinutes"]), minimum=0, maximum=1440)
    c.add("intensity_minutes_vigorous", _first(summary, ["vigorousIntensityMinutes"]), minimum=0, maximum=1440)
    c.add("floors_climbed", _first(summary, ["floorsAscended"]), minimum=0, maximum=2000)


def map_hrv(c: _Collector, hrv: Any) -> None:
    """get_hrv_data(date) → nightly avg, 7-day avg, status. Garmin HRV is RMSSD-based."""
    s = _get(hrv, "hrvSummary")
    if not isinstance(s, dict):
        return
    c.add("hrv_night_avg_ms", _first(s, ["lastNightAvg"]), minimum=1, maximum=300)
    c.add("hrv_weekly_avg_ms", _first(s, ["weeklyAvg"]), minimum=1, maximum=300)
    c.add("hrv_baseline_low_ms", _first(s, ["baseline.balancedLow"]), minimum=1, maximum=300)
    c.add("hrv_baseline_high_ms", _first(s, ["baseline.balancedUpper"]), minimum=1, maximum=300)
    status = s.get("status")
    if isinstance(status, str) and status.upper() in HRV_STATUS_CODES:
        c.add("hrv_status", HRV_STATUS_CODES[status.upper()], digits=0)


def map_sleep(c: _Collector, sleep: Any) -> None:
    """get_sleep_data(date) → sleep stages, score, overnight respiration and SpO2.

    Garmin files a night under the date you wake up. Coach uses the same rule.
    """
    dto = _get(sleep, "dailySleepDTO")
    if not isinstance(dto, dict):
        return
    total = _num(dto.get("sleepTimeSeconds"))
    if not total or total <= 0:
        return  # No sleep recorded: Garmin still sends a DTO full of nulls.

    def minutes(key: str) -> float | None:
        v = _num(dto.get(key))
        return None if v is None else v / 60

    c.add("sleep_total_min", total / 60, digits=0)
    c.add("sleep_deep_min", minutes("deepSleepSeconds"), minimum=0, digits=0)
    c.add("sleep_rem_min", minutes("remSleepSeconds"), minimum=0, digits=0)
    c.add("sleep_core_min", minutes("lightSleepSeconds"), minimum=0, digits=0)
    c.add("sleep_awake_min", minutes("awakeSleepSeconds"), minimum=0, digits=0)
    c.add(
        "sleep_score",
        _first(dto, ["sleepScores.overall.value"]),
        minimum=0,
        maximum=100,
        digits=0,
    )
    c.add(
        "respiratory_rate",
        _first(dto, ["averageRespirationValue"]),
        minimum=4,
        maximum=40,
    )
    c.add("sleep_avg_hr_bpm", _first(dto, ["avgHeartRate"]), minimum=20, maximum=200)
    c.add("sleep_avg_stress", _first(dto, ["avgSleepStress"]), minimum=0, maximum=100)
    c.add("sleep_awake_count", _first(dto, ["awakeCount"]), minimum=0, maximum=200)
    # Skin temperature deviation from the personal baseline (watches with the sensor).
    c.add("wrist_temp_delta_c", _first(sleep, ["avgSkinTempDeviationC"]), minimum=-5, maximum=5, digits=2)


def map_spo2(c: _Collector, summary: Any, sleep: Any) -> None:
    """Daily average SpO2 from the summary, else the overnight average from sleep."""
    value = _first(summary, ["averageSpo2", "averageSpO2"])
    if value is None:
        value = _first(_get(sleep, "dailySleepDTO"), ["averageSpO2Value", "avgSpO2"])
    c.add("spo2_pct", value, minimum=50, maximum=100)


def map_readiness(c: _Collector, readiness: Any) -> None:
    """get_training_readiness(date) → the morning score (AFTER_WAKEUP_RESET), else the first entry."""
    if isinstance(readiness, dict):
        readiness = [readiness]
    if not isinstance(readiness, list):
        return
    entries = [e for e in readiness if isinstance(e, dict)]
    if not entries:
        return
    morning = [e for e in entries if e.get("inputContext") == "AFTER_WAKEUP_RESET"]
    chosen = morning[0] if morning else entries[0]
    c.add("training_readiness", _first(chosen, ["score"]), minimum=0, maximum=100, digits=0)
    c.add("readiness_sleep_factor", _first(chosen, ["sleepScoreFactorPercent"]), minimum=0, maximum=100, digits=0)
    c.add("readiness_hrv_factor", _first(chosen, ["hrvFactorPercent"]), minimum=0, maximum=100, digits=0)
    # recoveryTime is in minutes (1500 = the 25 h the watch shows).
    recovery = _first(chosen, ["recoveryTime"])
    c.add("readiness_recovery_time_h", None if recovery is None else recovery / 60, minimum=0, maximum=200)
    c.add("readiness_acute_load", _first(chosen, ["acuteLoad"]), minimum=0, maximum=5000, digits=0)


def map_max_metrics(c: _Collector, max_metrics: Any) -> None:
    """get_max_metrics(date) → running (generic) VO2max as vo2max, cycling VO2max as vo2max_cycling.

    Each is set only when Garmin has an estimate of that sport for the day.
    """
    if isinstance(max_metrics, dict):
        max_metrics = [max_metrics]
    if not isinstance(max_metrics, list):
        return
    for metric, sport in (("vo2max", "generic"), ("vo2max_cycling", "cycling")):
        for entry in max_metrics:
            value = _first(entry, [f"{sport}.vo2MaxPreciseValue", f"{sport}.vo2MaxValue"])
            if value is not None:
                c.add(metric, value, minimum=10, maximum=100)
                break


def _primary(by_device: Any) -> dict[str, Any] | None:
    """Garmin keys some data by device id: take the primary training device, else the first."""
    if not isinstance(by_device, dict):
        return None
    entries = [v for v in by_device.values() if isinstance(v, dict)]
    for e in entries:
        if e.get("primaryTrainingDevice") is True:
            return e
    return entries[0] if entries else None


def training_status_code(entry: dict[str, Any]) -> int | None:
    if entry.get("trainingPaused") is True:
        return TRAINING_STATUS_CODES["PAUSED"]
    phrase = entry.get("trainingStatusFeedbackPhrase")
    if not isinstance(phrase, str):
        return None
    for name in sorted(TRAINING_STATUS_CODES, key=len, reverse=True):  # UNPRODUCTIVE before PRODUCTIVE
        if phrase.upper().startswith(name):
            return TRAINING_STATUS_CODES[name]
    return None


def _recent(entry_date: Any, day: str, max_age_days: int = 7) -> bool:
    """Garmin sends the most recent value as of `day`. Use it if it is from `day` or a few days before."""
    d = _day_of(entry_date)
    if d is None:
        return True
    from datetime import date as _date

    try:
        age = (_date.fromisoformat(day) - _date.fromisoformat(d)).days
    except ValueError:
        return False
    return 0 <= age <= max_age_days


def map_training_status(c: _Collector, ts: Any) -> None:
    """get_training_status(date) → status, acute/chronic load and ratio, 4-week load focus (as of that day)."""
    status = _primary(_get(ts, "mostRecentTrainingStatus.latestTrainingStatusData"))
    if status and _recent(status.get("calendarDate"), c.date):
        code = training_status_code(status)
        if code is not None:
            c.add("training_status", code)
        acute = status.get("acuteTrainingLoadDTO")
        c.add("training_load_acute", _first(acute, ["dailyTrainingLoadAcute"]), minimum=0, maximum=5000)
        c.add("training_load_chronic", _first(acute, ["dailyTrainingLoadChronic"]), minimum=0, maximum=5000)
        c.add("training_load_ratio", _first(acute, ["dailyAcuteChronicWorkloadRatio"]), minimum=0, maximum=10, digits=2)
    balance = _primary(_get(ts, "mostRecentTrainingLoadBalance.metricsTrainingLoadBalanceDTOMap"))
    if balance and _recent(balance.get("calendarDate"), c.date):
        c.add("load_focus_anaerobic", _first(balance, ["monthlyLoadAnaerobic"]), minimum=0, maximum=20000, digits=0)
        c.add("load_focus_high_aerobic", _first(balance, ["monthlyLoadAerobicHigh"]), minimum=0, maximum=20000, digits=0)
        c.add("load_focus_low_aerobic", _first(balance, ["monthlyLoadAerobicLow"]), minimum=0, maximum=20000, digits=0)


def map_scores(c: _Collector, endurance: Any, hill: Any) -> None:
    """get_endurance_score(date) and get_hill_score(date): the day's overall scores."""
    if isinstance(endurance, dict) and endurance.get("calendarDate") in (None, c.date):
        c.add("endurance_score", _first(endurance, ["overallScore"]), minimum=0, maximum=15000)
    if isinstance(hill, dict) and hill.get("calendarDate") in (None, c.date):
        c.add("hill_score", _first(hill, ["overallScore"]), minimum=0, maximum=100)


def map_race_predictions(c: _Collector, preds: Any) -> None:
    """get_race_predictions(date, date, "daily") → predicted times in seconds."""
    if isinstance(preds, list):
        preds = next((p for p in preds if isinstance(p, dict) and p.get("calendarDate") == c.date), None)
    if not isinstance(preds, dict):
        return
    for metric, key in (
        ("race_pred_5k_s", "time5K"),
        ("race_pred_10k_s", "time10K"),
        ("race_pred_half_s", "timeHalfMarathon"),
        ("race_pred_marathon_s", "timeMarathon"),
    ):
        c.add(metric, _first(preds, [key]), minimum=300, maximum=86400, digits=0)


def split_body_composition(body: Any) -> dict[str, dict[str, Any]]:
    """The range response as one payload per day with weigh-ins, for the raw archive."""
    out: dict[str, dict[str, Any]] = {}
    entries = _get(body, "dateWeightList")
    for entry in entries if isinstance(entries, list) else []:
        if isinstance(entry, dict) and (day := _weigh_in_date(entry)):
            out.setdefault(day, {"dateWeightList": []})["dateWeightList"].append(entry)
    return out


def wear_minutes(heart_rates: Any, summary: Any) -> float | None:
    """Minutes the watch recorded heart rate that day: 0 means synced but not worn, None means unknown.

    Garmin sends all-day heart rate as [timestamp ms, bpm or null] every 2 minutes. Without a heart rate response,
    a summary with includesWellnessData false still says the watch recorded nothing.
    """
    values = _get(heart_rates, "heartRateValues")
    if isinstance(heart_rates, dict) and heart_rates.get("privacyProtected") is not True:
        rows = [r for r in values if isinstance(r, list) and len(r) >= 2] if isinstance(values, list) else []
        stamps = sorted(t for t, v in ((_num(r[0]), _num(r[1])) for r in rows) if t is not None and v is not None and v > 0)
        if not stamps:
            return 0
        gaps = sorted(b - a for a, b in zip(stamps, stamps[1:]) if b > a)
        step_min = gaps[len(gaps) // 2] / 60000 if gaps else 2
        step_min = min(max(step_min, 1), 15)
        return min(len(stamps) * step_min, 1440)
    if isinstance(summary, dict) and summary.get("includesWellnessData") is False:
        return 0
    return None


def map_day(date: str, raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Map the raw responses for one calendar date. Missing keys are fine."""
    c = _Collector(date)
    map_summary(c, raw.get("summary"))
    map_hrv(c, raw.get("hrv"))
    map_sleep(c, raw.get("sleep"))
    map_spo2(c, raw.get("summary"), raw.get("sleep"))
    map_readiness(c, raw.get("readiness"))
    map_max_metrics(c, raw.get("max_metrics"))
    map_training_status(c, raw.get("training_status"))
    map_scores(c, raw.get("endurance_score"), raw.get("hill_score"))
    map_race_predictions(c, raw.get("race_predictions"))
    c.add("wear_min", wear_minutes(raw.get("heart_rates"), raw.get("summary")), minimum=0, maximum=1440, digits=0)
    return c.samples


def _day_of(value: Any) -> str | None:
    """"2026-10-14T07:58:55.857" or "2026-10-14" → "2026-10-14"."""
    if isinstance(value, str) and len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return value[:10]
    return None


def lt_pace_s_per_km(speed: float | None) -> float | None:
    """Garmin's lactate threshold speed is in units of 10 m/s (0.3 = 3 m/s = 5:33 /km)."""
    if speed is None or speed <= 0:
        return None
    return 1000 / (speed * 10)


def map_periodic(run_date: str, raw: dict[str, Any]) -> list[dict[str, Any]]:
    """The once-a-run sources. Each value goes on the day Garmin measured it, else on the run date."""
    samples: list[dict[str, Any]] = []

    lt = raw.get("lactate_threshold")
    sh = _get(lt, "speed_and_heart_rate")
    if isinstance(sh, dict):
        c = _Collector(_day_of(sh.get("calendarDate")) or run_date)
        c.add("lactate_threshold_hr_bpm", _first(sh, ["heartRate"]), minimum=60, maximum=230, digits=0)
        c.add("lactate_threshold_pace_s_per_km", lt_pace_s_per_km(_first(sh, ["speed"])), minimum=120, maximum=900, digits=0)
        samples.extend(c.samples)

    ftp = raw.get("cycling_ftp")
    if isinstance(ftp, list):
        ftp = ftp[0] if ftp and isinstance(ftp[0], dict) else None
    if isinstance(ftp, dict):
        c = _Collector(_day_of(ftp.get("calendarDate")) or run_date)
        c.add("cycling_ftp_w", _first(ftp, ["functionalThresholdPower"]), minimum=20, maximum=700, digits=0)
        samples.extend(c.samples)

    samples.extend(map_fitness_age(run_date, raw.get("fitness_age")))
    return samples


def map_fitness_age(date: str, fa: Any) -> list[dict[str, Any]]:
    """get_fitness_age_details(date) → fitness age in years on that date."""
    c = _Collector(date)
    c.add("fitness_age", _first(fa, ["fitnessAge"]), minimum=10, maximum=120)
    return c.samples


def map_lactate_history(history: Any) -> list[dict[str, Any]]:
    """get_lactate_threshold(latest=False, …, aggregation="daily") → one sample per update day."""
    samples: list[dict[str, Any]] = []
    for key, metric in (("heart_rate", "lactate_threshold_hr_bpm"), ("speed", "lactate_threshold_pace_s_per_km")):
        series = _get(history, key)
        if not isinstance(series, list):
            continue
        for point in series:
            if not isinstance(point, dict) or point.get("series") not in (None, "running"):
                continue
            day = _day_of(point.get("updatedDate")) or _day_of(point.get("until"))
            value = _num(point.get("value"))
            if day is None or value is None:
                continue
            c = _Collector(day)
            if metric == "lactate_threshold_hr_bpm":
                c.add(metric, value, minimum=60, maximum=230, digits=0)
            else:
                c.add(metric, lt_pace_s_per_km(value), minimum=120, maximum=900, digits=0)
            samples.extend(c.samples)
    return samples


# --------------------------------------------------------------------------- #
# Raw archive
# --------------------------------------------------------------------------- #

# Keys that identify the account. Removed at any depth before a payload leaves the job.
_ID_KEYS = frozenset(
    {"userprofilepk", "userprofileid", "userid", "userpk", "profileid", "ownerid", "username", "displayname", "userdailysummaryid"}
)
_ID_PARTS = ("displayname", "fullname", "email", "profileimage", "userprofile")


def _is_id_key(key: str) -> bool:
    k = key.lower()
    return k in _ID_KEYS or any(part in k for part in _ID_PARTS)


def redact(value: Any, identifiers: frozenset[Any] = frozenset()) -> Any:
    """A copy without account identifiers (profile ids, names, emails) and without U+0000 (Postgres jsonb refuses it).

    A key is dropped when its name is an id name, or when its value is one of `identifiers` (the account's profile
    id, display name and full name, which sync.py reads after login). Everything else stays: the time series,
    device ids and activity ids.
    """
    def drop(k: Any, v: Any) -> bool:
        if isinstance(k, str) and _is_id_key(k):
            return True
        return bool(identifiers) and not isinstance(v, (dict, list, bool)) and v in identifiers

    if isinstance(value, dict):
        return {k: redact(v, identifiers) for k, v in value.items() if not drop(k, v)}
    if isinstance(value, list):
        return [redact(v, identifiers) for v in value if not (identifiers and not isinstance(v, (dict, list, bool)) and v in identifiers)]
    if isinstance(value, str):
        return value.replace("\x00", "")
    return value


def is_empty(payload: Any) -> bool:
    return payload is None or payload == {} or payload == [] or payload == ""


def _weigh_in_date(entry: dict[str, Any]) -> str | None:
    value = entry.get("calendarDate")
    return value if isinstance(value, str) and len(value) == 10 else None


def map_body_composition(body: Any) -> list[dict[str, Any]]:
    """get_body_composition(start, end) → one weight and body-fat sample per day.

    Garmin sends weight in grams. With several weigh-ins on one day, the last one wins.
    """
    entries = _get(body, "dateWeightList")
    if not isinstance(entries, list):
        return []
    latest: dict[str, dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        day = _weigh_in_date(entry)
        if day is None:
            continue
        stamp = _num(entry.get("date")) or _num(entry.get("timestampGMT")) or 0
        prev = latest.get(day)
        prev_stamp = (_num(prev.get("date")) or _num(prev.get("timestampGMT")) or 0) if prev else -1
        if stamp >= prev_stamp:
            latest[day] = entry

    samples: list[dict[str, Any]] = []
    for day in sorted(latest):
        entry = latest[day]
        c = _Collector(day)
        grams = _num(entry.get("weight"))
        if grams is not None:
            # Grams from the weight service; tolerate a kilogram value too.
            kg = grams / 1000 if grams > 1000 else grams
            c.add("weight_kg", kg, minimum=20, maximum=300, digits=2)
        c.add("body_fat_pct", _num(entry.get("bodyFat")), minimum=1, maximum=70)
        samples.extend(c.samples)
    return samples
