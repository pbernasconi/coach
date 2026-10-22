import Foundation
import LiftSync
import Testing

@testable import Lift

/// The shared "How did it feel" flow (WorkoutFeedbackEdit) and the save body. Made-up values (TEST-8).
@Suite struct WorkoutFeedbackEditTests {
    let loaded = WorkoutFeedback(
        item: "strava:1",
        date: "2026-10-19",
        feel: 3,
        rpe: 5,
        fromWatch: true,
        feelLabels: ["Very weak", "Weak", "Normal", "Strong", "Very strong"],
        rpeScale: (1...10).map { WorkoutFeedback.RPEStep(value: $0, label: "L\($0)", detail: "D\($0)") }
    )

    @Test func aSecondTapOnTheSameFaceOrEffortClearsIt() {
        #expect(loaded.applying(.feel(3)).feel == nil)
        #expect(loaded.applying(.feel(4)).feel == 4)
        #expect(loaded.applying(.rpe(5)).rpe == nil)
        #expect(loaded.applying(.comment("   ")).comment == nil)
        #expect(loaded.applying(.feel(4)).fromWatch == false)
    }

    @Test func anOlderAnswerNeverOverwritesANewerEdit() throws {
        var edit = WorkoutFeedbackEdit()
        let firstSave = edit.handle(.changed(.feel(1)), loaded: loaded)
        let secondSave = edit.handle(.changed(.feel(5)), loaded: loaded)
        let first = try #require(firstSave)
        let second = try #require(secondSave)

        edit.finish(nil, attempt: first.attempt)
        #expect(edit.save == .saving)
        edit.finish(second.feedback, attempt: second.attempt)
        #expect(edit.save == .saved)
        #expect(edit.shown(loaded)?.feel == 5)
    }

    @Test func nothingToSaveWithoutFeedback() {
        var edit = WorkoutFeedbackEdit()
        #expect(edit.handle(.changed(.feel(1)), loaded: nil) == nil)
        #expect(edit.save == .idle)
    }

    @Test func theSaveBodySendsEveryValueWithNullForEmptyOnes() throws {
        let body = try #require(try JSONSerialization.jsonObject(with: loaded.saveBody()) as? [String: Any])
        #expect(Set(body.keys) == ["item", "date", "title", "planActivityId", "feel", "rpe", "comment"])
        #expect(body["title"] is NSNull)
        #expect(body["rpe"] as? Int == 5)
    }
}
