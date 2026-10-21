import Foundation

extension AppAPISamples {
    /// The `GET /api/app/lift/sessions/{id}` example of APP-API.md, as written there.
    public static let liftSessionContract = #"""
        {
          "generatedAt": "2026-10-20T21:03:46.996Z", "timeZone": "America/Los_Angeles",
          "id": "ca4f651b-98c7-4765-83a9-07ab74435d69", "unit": "lb",
          "olderId": "004c7644-399d-44f4-9a61-8dea412c70c9", "newerId": "704c31ca-c04b-478b-802b-2f2219cad990",
          "hero": {
            "ok": true, "kicker": "Strength · Tue, Oct 20, 2026", "date": "2026-10-20", "dateText": "Tue, Oct 20, 2026",
            "startText": null, "title": "Heavy barbell", "note": null, "state": "planned", "stateLabel": "Planned",
            "stats": [
              { "id": "exercises", "label": "Exercises", "value": "9", "detail": null },
              { "id": "sets", "label": "Sets", "value": "0 / 25", "detail": "logged" },
              { "id": "plannedVolume", "label": "Planned volume", "value": "18,318 lb", "detail": null },
              { "id": "volume", "label": "Logged volume", "value": "0 lb", "detail": "warm-ups excluded" },
              { "id": "duration", "label": "Duration", "value": "–", "detail": null }
            ],
            "ring": { "logged": 0, "total": 25, "progress": 0, "text": "0/25", "caption": "sets logged" },
            "muscles": [{ "muscle": "back", "name": "Back", "sets": 8, "setsText": "8", "relative": 1 },
                        { "muscle": "glutes", "name": "Glutes", "sets": 7, "setsText": "7", "relative": 0.875 }]
          },
          "exercises": {
            "ok": true, "emptyText": "This session has no exercises.",
            "items": [{
              "id": "543a30ee-4b76-4223-8cb7-73f5e2c35410", "exerciseKey": "id-4c494654-0000-4000-8000-000000000001",
              "indexText": "Exercise 1", "name": "Back squat", "setsText": "0/3 sets", "complete": false,
              "muscles": ["Quads", "Glutes"], "secondaryMuscles": ["Hamstrings", "Core"], "equipment": "Barbell",
              "loadNote": null, "restText": "3:00 rest", "note": "Warm up, about 12 min. …",
              "sets": [
                { "id": "01ee58bf-223d-4d80-9650-9b6b322a06a1", "label": "Set 1", "kind": "working", "status": "planned",
                  "text": "230 lb × 5", "targetText": null, "beatTarget": false, "rpe": null, "rpeText": null, "note": null }
              ],
              "lastTime": { "sessionId": "7b20985d-d7fc-5c26-8c08-61a08eb1bd1a", "date": "2026-09-25",
                            "title": "Last time · Sep 25", "delta": -25, "deltaText": "−25 lb vs last",
                            "sets": ["255 lb × 8", "255 lb × 8", "255 lb × 8"] },
              "lastTimeEmptyText": null,
              "best": { "e1rm": 340, "text": "340 lb", "date": "2026-05-28", "dateText": "May 28" },
              "trend": { "values": [323, 323, 310.3, 323, 323, 323, 323, 323, 323, 323], "caption": "e1RM · last 10 sessions" },
              "steps": ["Stand with your feet shoulder-width apart, toes slightly turned out."],
              "media": { "image": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae…/images/0043-qXTaZnJ.jpg",
                         "gif": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae…/videos/0043-qXTaZnJ.gif" }
            }]
          }
        }
        """#
}
