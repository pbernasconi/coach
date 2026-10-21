import Foundation

/// The Lift weekly volume and exercise examples of APP-API.md, as written there (made up, TEST-8).
extension AppAPISamples {
    /// `GET /api/app/lift/weekly`.
    public static let liftWeeklyContract = #"""
        {
          "generatedAt": "2026-10-20T21:03:45.974Z", "unit": "lb",
          "weeks": {
            "ok": true, "title": "Weekly volume",
            "caption": "Weeks start on Monday. Volume = reps x logged weight over logged sets, warm-ups excluded, in lb.",
            "emptyText": "No sessions yet.",
            "items": [
              { "week": "2026-09-28", "weekText": "Mon, Sep 28, 2026", "sessions": 1, "sets": 18, "volume": 6440,
                "volumeText": "6,440 lb", "relative": 0.249 }
            ]
          }
        }
        """#

    /// `GET /api/app/lift/exercises/{key}`.
    public static let liftExerciseContract = #"""
        {
          "generatedAt": "2026-10-20T21:03:55.564Z", "unit": "lb",
          "exerciseKey": "id-4c494654-0000-4000-8000-000000000019", "name": "Overhead triceps extension",
          "stats": { "ok": true, "items": [
            { "id": "sessions", "label": "Sessions", "value": "24", "detail": null },
            { "id": "sets", "label": "Logged sets", "value": "74", "detail": "Warm-ups excluded" },
            { "id": "heaviest", "label": "Heaviest set", "value": "60 lb", "detail": null },
            { "id": "best", "label": "Best est. 1RM", "value": "76 lb", "detail": null } ] },
          "chart": {
            "ok": true, "title": "Estimated 1RM over time",
            "caption": "Best set per session, Epley: weight x (1 + reps / 30), 1 to 12 reps, in lb.",
            "emptyText": "No sets with weight and 1 to 12 reps.",
            "points": [{ "date": "2026-09-29", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "e1rm": 60,
                         "label": "Tue, Sep 29, 2026: 60 lb est. 1RM (45 lb x 10)" }]
          },
          "sessions": { "ok": true, "items": [
            { "date": "2026-09-29", "dateText": "Tue, Sep 29, 2026", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120",
              "bestSetText": "45 lb x 10", "e1rm": 60, "e1rmText": "60 lb" } ] },
          "bestSets": { "ok": true, "title": "Best sets", "caption": "Top sets by estimated 1RM.", "items": [
            { "date": "2026-08-11", "dateText": "Tue, Aug 11, 2026", "sessionId": "6156ec87-fc83-5f6a-9244-eb8a7c3f6582",
              "weightText": "60 lb", "repsText": "8", "e1rm": 76, "e1rmText": "76 lb" } ] }
        }
        """#
}
