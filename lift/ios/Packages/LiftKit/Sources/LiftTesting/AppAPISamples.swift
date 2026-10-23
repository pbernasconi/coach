import Foundation

/// App API bodies for tests (lift/APP-API.md). Copied from the contract's examples, which are made up (TEST-8).
public enum AppAPISamples {
    /// The `GET /api/app/today` example of APP-API.md, as written there.
    public static let todayContract = #"""
        {
          "generatedAt": "2026-10-20T21:02:24.435Z",
          "timeZone": "America/Los_Angeles",
          "today": "2026-10-20",
          "dateText": "Tuesday, October 20",
          "header": {
            "ok": true,
            "chips": [
              { "key": "readiness", "label": "Readiness", "value": 56, "valueText": "56 · Moderate", "tone": "good" },
              { "key": "sleep", "label": "Sleep", "value": 442, "valueText": "7:22", "tone": "warn" },
              { "key": "hrv", "label": "HRV", "value": "Balanced", "valueText": "Balanced", "tone": "good" },
              { "key": "fitness", "label": "Fit / Fat", "value": 53, "valueText": "53 / 42", "tone": "neutral" },
              { "key": "form", "label": "Form", "value": 10, "valueText": "+10", "tone": "good" }
            ],
            "emptyText": null
          },
          "stale": { "ok": true, "text": null },
          "todayLine": {
            "ok": true,
            "items": [
              { "id": "ylfw7n0i8xabidggyzmge38q", "title": "Heavy barbell lift", "sport": "strength", "state": "today",
                "text": "10:30 · 1:15", "liftSessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69" }
            ],
            "emptyText": null,
            "cue": "Readiness moderate: hold back about 10%"
          },
          "fitness": {
            "ok": true,
            "today": "2026-10-20",
            "days": [
              { "date": "2026-06-22", "ctl": 60.8, "atl": 67.6, "tsb": -6.8, "tss": 0, "projected": false },
              { "date": "2026-10-21", "ctl": 53.1, "atl": 48.2, "tsb": 4.8, "tss": 95, "projected": true }
            ],
            "zones": [
              { "label": "Fresh", "from": 5, "to": null, "shade": true },
              { "label": "Neutral", "from": -10, "to": 5, "shade": false },
              { "label": "Productive", "from": -30, "to": -10, "shade": true },
              { "label": "Overreaching", "from": null, "to": -30, "shade": false }
            ],
            "events": [{ "id": "12", "name": "Haute Route", "date": "2026-11-01", "priority": "A" }],
            "now": { "date": "2026-10-19", "ctl": 52.6, "atl": 42.2, "tsb": 10.4, "zone": "Fresh" },
            "caption": "Projection to 2026-11-03: 1210 planned TSS, fitness 61, form -8."
          },
          "last4Weeks": {
            "ok": true,
            "tiles": [
              { "key": "time", "label": "Time · 4 weeks", "valueText": "26:36 h", "noteText": "6.6 h a week", "sport": null },
              { "key": "run", "label": "Run", "valueText": "72 km", "noteText": "5:35 /km", "sport": "run" },
              { "key": "ride", "label": "Ride", "valueText": "313 km", "noteText": "14:14 h", "sport": "ride" },
              { "key": "strength", "label": "Strength", "valueText": "2 of 8", "noteText": "sessions", "sport": "strength" }
            ]
          },
          "body": {
            "ok": true,
            "weight": { "date": "2026-10-19", "kg": 78.4, "text": "78.4", "unit": "kg", "change4w": -1.2,
                        "changeText": "▼ 0.26 kg/wk", "changeTone": "good", "noteText": "Trend 78.9 kg · ▼ 1.2 kg in 4 weeks" },
            "trend": { "kg": 78.9, "text": "78.9", "rate": { "kgPerWeek": -0.26, "text": "▼ 0.26 kg/wk", "tone": "good" },
                       "offKg": -0.5, "swingKg": 0.6, "noteText": "Today is 0.5 kg under your trend, …" },
            "series": [{ "date": "2026-08-01", "kg": 79.7, "trendKg": 79.92 }, { "date": "2026-10-19", "kg": 78.4, "trendKg": 78.9 }],
            "bodyFat": 14.3,
            "bodyFatText": "14.3 %",
            "emptyText": null
          },
          "lift": {
            "ok": true,
            "unit": "lb",
            "hasData": true,
            "arms": {
              "band": { "min": 10, "max": 20 },
              "bandText": "target 10–20",
              "rows": [{ "muscle": "biceps", "sets": 5.5, "setsText": "5.5" }, { "muscle": "triceps", "sets": 0, "setsText": "0" }]
            },
            "mainLifts": [
              { "exerciseKey": "id-4c494654-0000-4000-8000-000000000001", "name": "Back squat",
                "points": [{ "day": "2026-09-16", "e1rm": 310.5 }, { "day": "2026-09-25", "e1rm": 323 }],
                "latest": 323, "latestText": "323 lb", "change": 0.041, "changeText": "+4%", "tone": "good", "sparkText": null }
            ],
            "mainLiftsEmptyText": null,
            "strength": { "done": 0, "target": 2, "text": "0 / 2 this week" },
            "last": { "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "day": "2026-09-29", "daysSince": 21,
                      "whenText": "21 days ago", "late": true, "title": "Workout C", "prs": 0, "text": "Workout C" },
            "next": { "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "day": "2026-10-20", "dateText": "Oct 20", "title": "Heavy barbell" },
            "nextEmptyText": null
          },
          "goals": {
            "ok": true,
            "items": [
              { "id": "run-10k-4min", "kind": "run_10k_pace", "title": "Run 10k at 4:00/km", "status": "open", "statusText": "open",
                "current": 297.51, "currentText": "4:58/km", "target": 240, "targetText": "4:00/km", "deadline": "2027-06-01",
                "daysLeft": 224, "timeText": "224 days left · 2027-06-01", "progress": 0.01,
                "detail": ["Best 10k+ run in 12 months: 4:58/km (Morning Run, 2025-11-13)", "Garmin 10k prediction: 4:49/km"] }
            ],
            "emptyText": null
          }
        }
        """#

    /// The Today example with every section `{ "ok": false }` but the header.
    public static let todayFailedSections = #"""
        {"generatedAt":"2026-10-20T21:02:24.435Z","timeZone":"UTC","today":"2026-10-20","dateText":"Tuesday",
         "header":{"ok":true,"chips":[],"emptyText":"No Garmin data today."},"stale":{"ok":false},
         "todayLine":{"ok":false},"fitness":{"ok":false},"last4Weeks":{"ok":false},"body":{"ok":false},
         "lift":{"ok":false},"goals":{"ok":false}}
        """#
}
