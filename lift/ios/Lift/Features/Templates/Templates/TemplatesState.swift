import Foundation
import LiftCore

/// Everything the Templates screen renders. Exclusive states are enums or optionals (SCR-6).
nonisolated struct TemplatesState: Equatable, Sendable {
    var templates: Loadable<[TemplateItem]> = .loading
    /// The template whose options sheet is open.
    var options: TemplateItem?
    /// The latest message for the toast slot.
    var toast: TemplatesToast?
}

/// One template as the list shows it.
nonisolated struct TemplateItem: Equatable, Sendable, Identifiable {
    var id: UUID
    var name: String
    /// "Back squat, Romanian deadlift, Calf raise".
    var exercises: String
    /// "3 exercises · 8 sets".
    var size: String

    init(id: UUID, name: String, exercises: String, size: String) {
        self.id = id
        self.name = name
        self.exercises = exercises
        self.size = size
    }

    init(template: DayTemplate) {
        self.init(
            id: template.id,
            name: template.name,
            exercises: TemplateText.exercises(template),
            size: TemplateText.size(exercises: template.exercises.count, sets: template.totalSets)
        )
    }
}

/// A short message for the toast slot. `serial` changes with every message, so the same message can show twice.
nonisolated struct TemplatesToast: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        /// A template was removed; the toast offers Undo.
        case removed(UUID, name: String)
        /// A write failed.
        case failed
    }

    var serial: Int
    var kind: Kind
}
