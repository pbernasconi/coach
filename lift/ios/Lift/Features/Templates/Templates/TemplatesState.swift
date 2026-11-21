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

/// One template as the list shows it: its name and size over every exercise with its sets, reps, load and rest.
nonisolated struct TemplateItem: Equatable, Sendable, Identifiable {
    var id: UUID
    var name: String
    /// "3 exercises · 8 sets".
    var size: String
    /// The exercises in workout order, as the template editor lists them.
    var slots: [TemplateSlotItem]

    init(id: UUID, name: String, size: String, slots: [TemplateSlotItem]) {
        self.id = id
        self.name = name
        self.size = size
        self.slots = slots
    }

    /// Loads in `unit`, as the editor shows them.
    init(template: DayTemplate, unit: WeightUnit) {
        self.init(
            id: template.id,
            name: template.name,
            size: TemplateText.size(exercises: template.exercises.count, sets: template.totalSets),
            slots: template.exercises.enumerated().map { index, slot in
                TemplateSlotItem(
                    id: slot.id,
                    number: index + 1,
                    name: slot.displayName,
                    detail: TemplateText.slot(slot, unit: unit)
                )
            }
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
