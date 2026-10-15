import Foundation
import LiftCore

/// Plain labels for templates and their slots: numbers and units, no commentary.
nonisolated enum TemplateText {
    /// "8–12" or "5".
    static func reps(_ range: ClosedRange<Int>) -> String {
        range.lowerBound == range.upperBound ? "\(range.lowerBound)" : "\(range.lowerBound)–\(range.upperBound)"
    }

    /// "1:30 rest" or "2 min rest".
    static func rest(_ seconds: Int) -> String {
        guard seconds % 60 != 0 else { return String(localized: "\(seconds / 60) min rest") }
        let padded = seconds % 60 < 10 ? "0\(seconds % 60)" : "\(seconds % 60)"
        return String(localized: "\(seconds / 60):\(padded) rest")
    }

    /// One slot: "3 × 8–12 @ 60 kg · 2 min rest", with the load in `unit`; the load and rest only when set.
    static func slot(_ slot: TemplateExercise, unit: WeightUnit) -> String {
        var text = "\(slot.sets) × \(reps(slot.repRange))"
        if let weight = slot.weight {
            text += " @ \(WorkoutText.weight(weight.converted(to: unit).rounded(toStep: 0.25)))"
        }
        if let seconds = slot.restSeconds, seconds > 0 {
            text += " · \(rest(seconds))"
        }
        return text
    }

    /// "3 exercises · 8 sets".
    static func size(exercises: Int, sets: Int) -> String {
        let setText = sets == 1 ? String(localized: "1 set") : String(localized: "\(sets) sets")
        return "\(SessionText.exercises(exercises)) · \(setText)"
    }

    /// The exercise names in order, "Back squat, Romanian deadlift", or a note that there are none yet.
    static func exercises(_ template: DayTemplate) -> String {
        guard !template.exercises.isEmpty else { return String(localized: "No exercises yet") }
        return template.exercises.map(\.displayName).joined(separator: ", ")
    }

    /// The name a new template gets: "New template", or "New template 2" and up when that is taken.
    static func newName(taken: [String]) -> String {
        let base = String(localized: "New template")
        let names = Set(taken)
        guard names.contains(base) else { return base }
        var number = 2
        while names.contains("\(base) \(number)") { number += 1 }
        return "\(base) \(number)"
    }
}
