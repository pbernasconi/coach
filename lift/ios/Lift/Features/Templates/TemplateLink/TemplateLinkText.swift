import Foundation
import LiftCore

/// Plain labels for the template link review and its toast: numbers and units, no commentary.
nonisolated enum TemplateLinkText {
    /// "1 template" or "3 templates".
    static func templates(_ count: Int) -> String {
        count == 1 ? String(localized: "1 template") : String(localized: "\(count) templates")
    }

    /// "Add 3 templates".
    static func add(_ count: Int) -> String {
        String(localized: "Add \(templates(count))")
    }

    /// "Added 3 templates".
    static func added(_ count: Int) -> String {
        String(localized: "Added \(templates(count))")
    }

    /// "3 × 8–10 @ 95 lb · 3 min rest": the link's sets, reps and load in its own unit, as `TemplateText.slot`.
    static func exercise(_ exercise: LinkedExercise) -> String {
        var text = "\(exercise.sets) × \(TemplateText.reps(exercise.repRange))"
        if let weight = exercise.weight {
            text += " @ \(WorkoutText.weight(weight))"
        }
        if exercise.restSeconds > 0 {
            text += " · \(TemplateText.rest(exercise.restSeconds))"
        }
        return text
    }

    /// "3 exercises · 9 sets · lb".
    static func detail(_ template: LinkedTemplate) -> String {
        let size = TemplateText.size(
            exercises: template.exercises.count,
            sets: template.exercises.reduce(0) { $0 + $1.sets }
        )
        return template.unit.map { "\(size) · \($0.rawValue)" } ?? size
    }

    /// The review step's heading and message for a link that cannot be added.
    static func problem(_ problem: TemplateLinkProblem) -> (title: String, message: String) {
        switch problem {
        case .unreadable:
            (String(localized: "This link can't be read"), String(localized: "Ask for the link again."))
        case .newerVersion:
            (String(localized: "This link needs a newer Coach app"), String(localized: "Update Coach, then open it again."))
        case .empty:
            (String(localized: "This link has no templates"), String(localized: "Ask for the link again."))
        case .tooLarge:
            (String(localized: "This link is too long"), String(localized: "Ask for fewer templates per link."))
        }
    }
}
