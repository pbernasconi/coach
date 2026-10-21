import Foundation

extension AppAPISamples {
    /// The `GET /api/app/lift` example of APP-API.md, as written there (lists cut to one or two entries).
    public static let liftOverviewContract = #"""
        {
          "generatedAt": "2026-10-20T21:03:45.321Z", "timeZone": "America/Los_Angeles", "today": "2026-10-20", "unit": "lb",
          "empty": null,
          "week": {
            "ok": true, "title": "This week · Oct 19–Oct 25", "done": 0, "target": 2, "doneText": "0 / 2",
            "caption": "strength sessions", "progress": 0, "targetMet": false,
            "days": [
              { "date": "2026-10-19", "letter": "M", "state": "none", "today": false, "sessionId": null, "label": "Monday" },
              { "date": "2026-10-20", "letter": "T", "state": "planned", "today": true,
                "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "label": "Tuesday: Heavy barbell planned" }
            ],
            "stats": [
              { "id": "sets", "label": "Sets", "value": "0", "detail": "hard sets this week", "flame": false },
              { "id": "volume", "label": "Volume", "value": "0 lb", "detail": "reps × weight", "flame": false },
              { "id": "last", "label": "Last lift", "value": "21 days ago", "detail": "Workout C · Sep 29", "flame": false },
              { "id": "streak", "label": "Streak", "value": "0 weeks", "detail": "at 2+ a week", "flame": false }
            ],
            "next": { "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "date": "2026-10-20", "title": "Heavy barbell",
                      "whenText": "Next up · today", "detail": "9 exercises · 25 sets planned" },
            "nextEmptyText": "No Lift session planned. Put one on the plan, or start one from a template in Lift."
          },
          "tips": {
            "ok": true, "title": "Coach notes",
            "items": [
              { "id": "gap", "tone": "warn", "title": "21 days since your last lift", "body": "Ease back in: 2 sets per exercise …",
                "link": { "kind": "session", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120" } },
              { "id": "stalled", "tone": "info", "title": "Overhead triceps extension and Back squat have stalled", "body": "No new best …",
                "link": { "kind": "exercise", "exerciseKey": "id-4c494654-0000-4000-8000-000000000019" } }
            ]
          },
          "lifts": {
            "ok": true, "caption": "estimated 1RM per session · dashed line is your best", "emptyText": "No lifts in the last 12 weeks.",
            "items": [
              { "exerciseKey": "id-4c494654-0000-4000-8000-000000000019", "name": "Overhead triceps extension",
                "sessions": 9, "sessionsText": "9 sessions", "newBest": false, "e1rm": 60, "e1rmText": "60",
                "change": -0.211, "changeText": "▼ 21% in 12 weeks", "best": 76,
                "points": [{ "date": "2026-09-29", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "e1rm": 60,
                             "label": "Sep 29: 45 × 10, e1RM 60" }],
                "chartEmptyText": null, "lastText": "Last 45 lb × 10 · Sep 29", "bestText": "Best 76 · Aug 3" }
            ]
          },
          "muscles": {
            "ok": true, "title": "Hard sets per muscle", "caption": "10–20 a week grows a muscle. Primary muscle 1 set, secondary ½.",
            "band": { "min": 10, "max": 20 }, "scaleMax": 24,
            "arms": [{ "muscle": "biceps", "name": "Biceps", "arm": true, "week": 0, "weekText": "0", "avg": 1.9, "avgText": "1.9",
                       "status": "below", "label": "Biceps: 0 sets this week, 1.9 a week on average, below the 10 to 20 range" }],
            "other": [{ "muscle": "back", "name": "Back", "arm": false, "week": 0, "weekText": "0", "avg": 3, "avgText": "3",
                        "status": "below", "label": "…" }]
          },
          "sessions": {
            "ok": true, "caption": "57 logged · volume = reps × weight, warm-ups out", "shown": 8,
            "upcoming": [{ "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "date": "2026-10-20", "title": "Heavy barbell",
                           "badge": "Today", "detail": "Tue, Oct 20 · 25 sets" }],
            "logged": [{ "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "date": "2026-09-29", "weekdayText": "Tue",
                         "dayText": "29", "monthText": "Sep", "title": "Workout C", "meta": "6 exercises · 18 sets · 43 min",
                         "sets": 18, "exercises": 6, "minutes": 43, "volume": 6440, "volumeText": "6,440", "volumeUnit": "lb",
                         "relative": 0.249, "muscles": ["Shoulders", "Triceps", "Biceps"], "prs": [], "prText": null }]
          },
          "exercises": {
            "ok": true, "title": "All exercises", "count": 56,
            "items": [{ "exerciseKey": "id-4c494654-0000-4000-8000-000000000006", "name": "Dumbbell bench press", "sessions": 10,
                        "detail": "10 sessions · last Sep 29", "bestText": "63 lb" }]
          },
          "consistency": {
            "ok": true, "caption": "16 weeks",
            "stats": [{ "id": "hits", "value": "3/8", "label": "weeks at target" },
                      { "id": "avg", "value": "1.1", "label": "a week, 8 wks" },
                      { "id": "total", "value": "57", "label": "sessions logged" }],
            "hits": 3, "avg": 1.1, "total": 57,
            "heatmap": [{ "start": "2026-10-19", "monthText": null,
                          "days": [{ "date": "2026-10-20", "sets": 0, "level": 0, "future": false, "today": true,
                                     "sessionId": null, "label": "Tue, Oct 20" }] }],
            "weeks": { "target": 2, "scaleMax": 3, "caption": "line = target 2",
                       "items": [{ "week": "2026-10-19", "sessions": 0, "sets": 0, "met": false,
                                   "label": "Week of Oct 19: 0 sessions, 0 sets" }] }
          },
          "records": {
            "ok": true, "title": "Recent records", "caption": "estimated 1RM",
            "emptyText": "No records yet. They appear when a set beats every earlier session.",
            "items": [{ "exerciseKey": "id-4c494654-0000-4000-8000-000000000009", "sessionId": "7b20985d-d7fc-5c26-8c08-61a08eb1bd1a",
                        "name": "Dumbbell shoulder press", "date": "2026-09-25", "detail": "28 lb × 8 · Sep 25",
                        "e1rm": 34.8, "e1rmText": "35", "gainText": "+3 lb" }]
          }
        }
        """#
}
