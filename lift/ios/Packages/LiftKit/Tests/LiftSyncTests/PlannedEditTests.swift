import Foundation
import Testing

@testable import LiftSync

/// The workout page's Edit (lift/APP-API.md, "Edit a workout"): the form as the server sends it, its body back, and the
/// form's text fields read as the web reads them. Made-up values only.
@Suite struct PlannedEditTests {
    @Test(arguments: [
        ("1:30", 90), ("0:45", 45), ("1h30", 90), ("1h30m", 90), ("90", 90), ("90 min", 90), ("90m", 90), (" 45 ", 45),
    ])
    func durationsReadAsTheWebReadsThem(text: String, minutes: Int) {
        #expect(PlannedEditText.minutes(text) == minutes)
    }

    @Test(arguments: ["", "abc", "1:", "1:300", "12345", "-5", "1.5"])
    func notADurationIsNil(text: String) {
        #expect(PlannedEditText.minutes(text) == nil)
    }

    @Test func numbersTakeACommaAndShowWithoutATrailingZero() {
        #expect(PlannedEditText.number("10,5") == 10.5)
        #expect(PlannedEditText.number(" 80 ") == 80)
        #expect(PlannedEditText.number("far") == nil)
        #expect(PlannedEditText.number("") == nil)
        #expect(PlannedEditText.text(80) == "80")
        #expect(PlannedEditText.text(10.5) == "10.5")
        #expect(PlannedEditText.text(nil) == "")
        #expect(PlannedEditText.clock(90) == "1:30")
        #expect(PlannedEditText.clock(5) == "0:05")
    }

    @Test func tssIsHoursTimesIFSquared() {
        #expect(PlannedEditText.estimatedTss(minutes: 60, intensityFactor: 0.75) == 56)
        #expect(PlannedEditText.estimatedTss(minutes: 90, intensityFactor: 0.65) == 63)
    }

    @Test func decodesTheForm() throws {
        let json = """
            { "sport": "ride", "date": "2026-10-27", "startTime": "07:00", "title": "Sweet spot", "duration": 90,
              "distanceKm": null, "tss": null, "effort": "easy", "description": "Steady.", "bank": "threshold-a",
              "level": 1, "otherSteps": false, "stepsMinutes": 90, "stepsTss": 84,
              "efforts": [{ "id": "easy", "label": "Easy", "if": 0.65 }],
              "bankOptions": [
                { "id": "threshold-a", "name": "Threshold A", "levels": ["6×5 min top of Z4", "7×5 min top of Z4"] }
              ] }
            """
        let form = try JSONDecoder().decode(PlannedEditForm.self, from: Data(json.utf8))
        #expect(form.startTime == "07:00")
        #expect(form.bank == "threshold-a")
        #expect(form.efforts.first?.intensityFactor == 0.65)
        #expect(form.bankOptions.first?.levels.count == 2)
    }

    @Test func emptyFieldsAreLeftOutOfTheBody() throws {
        let edit = PlannedWorkoutEdit(
            title: "Easy run",
            date: "2026-10-28",
            startTime: nil,
            duration: 45,
            distanceKm: nil,
            tss: nil,
            effort: "easy",
            description: "",
            bank: nil,
            level: 0
        )
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(edit)) as? [String: Any]
        #expect(object?["startTime"] == nil)
        #expect(object?["tss"] == nil)
        #expect(object?["bank"] == nil)
        #expect(object?["duration"] as? Double == 45)
        #expect(AppPlannedWorkout.path("p1") == "api/app/plan/p1")
    }
}
