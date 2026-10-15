import Foundation
import LiftCore

/// Everything the template editor renders. Exclusive states are enums or optionals (SCR-6).
nonisolated struct TemplateEditorState: Equatable, Sendable {
    /// The template; `.empty` once it was removed or if it never existed.
    var template: Loadable<TemplateOverview> = .loading
    /// The name field's text; saved on Return and when the screen closes.
    var name = ""
    /// The slot editor sheet, while it is open.
    var editor: SlotEditor?
    /// The latest message for the toast slot.
    var toast: TemplateEditorToast?
}

/// The template's slots in order.
nonisolated struct TemplateOverview: Equatable, Sendable {
    /// "3 exercises · 8 sets".
    var size: String
    var slots: [TemplateSlotItem]
}

/// One slot as the list shows it.
nonisolated struct TemplateSlotItem: Equatable, Sendable, Identifiable {
    var id: UUID
    /// Its place in the workout, from 1.
    var number: Int
    var name: String
    /// "3 × 8–12 @ 60 kg · 2 min rest".
    var detail: String
}

/// The slot editor: set count, rep range, load and rest. Done saves; nothing is saved before.
nonisolated struct SlotEditor: Equatable, Sendable, Identifiable {
    /// The values the steppers edit. A load of 0 means none: the last session decides.
    struct Values: Equatable, Sendable {
        var sets: Int
        var repMin: Int
        var repMax: Int
        var weight: Double
        var rest: Int
    }

    /// The slot being edited.
    var id: UUID
    /// The exercise's name.
    var title: String
    /// "Exercise 2 of 3".
    var subtitle: String
    var unit: WeightUnit
    /// The load stepper's step in `unit`.
    var step: Double
    var values: Values
    /// The values when the sheet opened, to tell whether anything changed.
    var saved: Values
    var canMoveUp: Bool
    var canMoveDown: Bool

    var hasChanges: Bool { values != saved }

    static let setRange = 1...10
    static let repRange = 1...50
    static let restRange = 0...600
    static let restStep = 15
}

/// A short message for the toast slot. `serial` changes with every message, so the same message can show twice.
nonisolated struct TemplateEditorToast: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        /// A slot was removed; the toast offers Undo.
        case removed(UUID)
        /// A write failed.
        case failed
    }

    var serial: Int
    var kind: Kind
}
