import Foundation
import Testing

@testable import LiftSync

/// The check-in after a workout starts from a blank feedback with the server's scales (src/lib/plan/feedback.mjs).
@Suite struct WorkoutFeedbackBlankTests {
    @Test func aBlankCarriesTheServersScalesAndNothingLogged() throws {
        let blank = WorkoutFeedback.blank(item: "lift:abc", date: "2026-03-02", title: "Lower A")

        #expect(blank.feel == nil && blank.rpe == nil && blank.comment == nil)
        #expect(blank.feelLabels == ["Very weak", "Weak", "Normal", "Strong", "Very strong"])
        #expect(blank.rpeScale.map(\.value) == Array(1...10))
        #expect(blank.rpeScale[6] == .init(value: 7, label: "Very hard", detail: "A few words at a time."))
        let body = try JSONSerialization.jsonObject(with: blank.applying(.rpe(7)).saveBody()) as? [String: Any]
        #expect(body?["item"] as? String == "lift:abc")
        #expect(body?["rpe"] as? Int == 7)
    }
}
