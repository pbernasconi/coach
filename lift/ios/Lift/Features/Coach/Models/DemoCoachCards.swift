import Foundation

/// Made-up cards for the demo coach, written as the server sends them (lift/APP-API.md, "Coach"), so the demo also
/// runs the real decoders. Fabricated data only.
nonisolated enum DemoCoachCards {
    static let workout = card(
        """
        { "kind": "workout", "workout": {
          "id": "demo-vo2", "date": "2026-10-27", "startTime": "09:00", "title": "VO2 B — Zwift", "sport": "ride",
          "subtitle": "09:00 · 75 min · 80 TSS", "state": "planned", "stateLabel": "Planned",
          "keyTargets": ["3 × 6 × 30 s at 330–360 W, 30 s easy"],
          "steps": [
            { "label": "Warm-up", "detail": "15:00 · 150–200 W" },
            { "label": "3 ×", "detail": "6 × 0:30 at 330–360 W, 0:30 easy; 5:00 easy between" },
            { "label": "Top of Z2", "detail": "10:00 · 186–199 W" },
            { "label": "Cool-down", "detail": "easy to the end" }
          ],
          "profile": [
            { "seconds": 900, "from": 0.6, "to": 0.6, "zone": "Z2" },
            { "seconds": 360, "from": 1.2, "to": 1.2, "zone": "Z5" }, { "seconds": 300, "from": 0.5, "to": 0.5, "zone": "Z1" },
            { "seconds": 360, "from": 1.2, "to": 1.2, "zone": "Z5" }, { "seconds": 300, "from": 0.5, "to": 0.5, "zone": "Z1" },
            { "seconds": 360, "from": 1.2, "to": 1.2, "zone": "Z5" }, { "seconds": 600, "from": 0.72, "to": 0.72, "zone": "Z2" },
            { "seconds": 900, "from": 0.5, "to": 0.5, "zone": "Z1" }
          ],
          "stats": { "time": "1:15:00", "tss": "80" } } }
        """)

    static let day = card(
        """
        { "kind": "day", "day": { "date": "2026-10-27", "title": "Tuesday 27 Oct", "allDay": ["Travel to the coast"], "blocks": [
          { "start": "08:00", "end": "08:30", "kind": "busy", "title": "Call with Sam" },
          { "start": "08:30", "end": "09:00", "kind": "free" },
          { "start": "09:00", "end": "10:15", "kind": "session", "title": "Heavy barbell", "workoutId": "demo-lift" },
          { "start": "10:15", "end": "13:30", "kind": "free" },
          { "start": "13:30", "end": "18:00", "kind": "busy", "title": "Travel" },
          { "start": "18:00", "end": "22:00", "kind": "busy", "title": "Team dinner" } ] } }
        """)

    static let week = card(
        """
        { "kind": "week", "week": { "start": "2026-10-26", "title": "Week 2: 10k test", "hasPlan": true,
          "totals": { "text": "3/8 done · 3:10 of 9:40 · 210 of 560 TSS", "plannedCount": 8, "doneCount": 3,
                      "missedCount": 1 },
          "days": [
            { "date": "2026-10-26", "items": [ \(item("2026-10-26", "a", "run", "done", "Easy run")) ] },
            { "date": "2026-10-27", "items": [ \(item("2026-10-27", "b", "strength", "done", "Heavy barbell")) ] },
            { "date": "2026-10-28", "items": [ \(item("2026-10-28", "c", "run", "missed", "Easy run + strides")),
                                               \(item("2026-10-28", "d", "strength", "done", "Upper")) ] },
            { "date": "2026-10-29", "items": [ \(item("2026-10-29", "e", "run", "today", "Shakeout run")) ] },
            { "date": "2026-10-30", "items": [ \(item("2026-10-30", "f", "run", "planned", "10k test")) ] },
            { "date": "2026-10-31", "items": [ \(item("2026-10-31", "g", "ride", "planned", "Easy spin")) ] },
            { "date": "2026-11-01", "items": [ \(item("2026-11-01", "h", "ride", "planned", "Long ride")) ] } ] } }
        """)

    static let exercise = card(
        """
        { "kind": "exercise", "exercise": { "name": "Romanian deadlift", "exerciseKey": "demo-rdl", "sessionId": null,
          "item": { "id": "x1", "exerciseKey": "demo-rdl", "indexText": "2", "name": "Romanian deadlift",
            "setsText": "3 × 8 @ 135 lb", "complete": false, "muscles": ["Hamstrings", "Glutes"],
            "secondaryMuscles": ["Lower back"], "equipment": "Barbell", "loadNote": "Same as last time", "sets": [],
            "lastTime": { "sessionId": "s0", "date": "2026-10-21", "title": "Lower A", "sets": ["8 × 135", "8 × 135", "7 × 135"] },
            "best": { "e1rm": 170, "text": "8 × 140 lb", "dateText": "Oct 7" },
            "media": { "image": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/0085-wQ2c4XD.jpg", "gif": null },
            "steps": [
              "Stand tall with the bar at your hips, feet hip-width apart.",
              "Push your hips back and keep a soft bend in the knees.",
              "Lower the bar along your legs until you feel the hamstrings stretch.",
              "Squeeze the glutes and drive the hips forward to stand up."
            ] }, "stats": null } }
        """)

    static let readiness = card(
        """
        { "kind": "readiness", "readiness": { "date": "2026-10-27",
          "header": { "chips": [
            { "key": "readiness", "label": "Readiness", "valueText": "48", "tone": "warn" },
            { "key": "sleep", "label": "Sleep", "valueText": "6 h 10", "tone": "warn" },
            { "key": "hrv", "label": "HRV", "valueText": "58 ms", "tone": "bad" },
            { "key": "fitness", "label": "Fitness", "valueText": "62", "tone": "neutral" },
            { "key": "form", "label": "Form", "valueText": "−14", "tone": "warn" } ] },
          "cue": "Amber: keep today easy.",
          "fitness": { "today": "2026-10-27", "zones": [], "events": [], "now": null, "days": [\(formDays)] } } }
        """)

    private static func item(_ date: String, _ id: String, _ sport: String, _ state: String, _ title: String) -> String {
        "{ \"id\": \"\(id)\", \"date\": \"\(date)\", \"title\": \"\(title)\", \"sport\": \"\(sport)\", \"state\": \"\(state)\", "
            + "\"stateLabel\": \"\(state.capitalized)\", \"subtitle\": \"\" }"
    }

    /// 42 made-up days of form, falling towards today.
    private static var formDays: String {
        (0..<42).map { index in
            let day = String(format: "2026-%02d-%02d", index < 26 ? 9 : 10, index < 26 ? index + 5 : index - 25)
            let form = 6 - Double(index) * 0.5 + (index.isMultiple(of: 7) ? 3 : 0)
            return "{ \"date\": \"\(day)\", \"ctl\": 60, \"atl\": \(60 - form), \"tsb\": \(form), \"projected\": false }"
        }.joined(separator: ", ")
    }

    private static func card(_ json: String) -> CoachAttachment {
        (try? JSONDecoder().decode(CoachAttachment.self, from: Data(json.utf8))) ?? .unknown
    }
}
