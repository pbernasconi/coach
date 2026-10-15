import Foundation
import LiftCore
import LiftStore

/// Everything the Workout screen renders. Exclusive states are enums or optionals (SCR-6).
nonisolated struct WorkoutState: Equatable, Sendable {
    /// The session; `.empty` once it was removed or if it never existed.
    var workout: Loadable<WorkoutOverview> = .loading
    /// The weight and reps editor, while it is open.
    var editor: SetEditor?
    /// The rest countdown after a set was logged.
    var rest: RestTimer?
    /// The latest message for the toast slot.
    var toast: WorkoutToast?
    /// Exercise stills by catalog id, loaded as their sections appear.
    var thumbnails: [String: MediaImage] = [:]
    /// The latest earlier session of each library exercise, by library exercise id, read once when the session loads.
    var previous: [UUID: PreviousSets] = [:]
}

/// The session header and its exercises in order.
nonisolated struct WorkoutOverview: Equatable, Sendable {
    var title: String
    /// "Thursday, 5 March".
    var dayTitle: String
    var loggedSets: Int
    var totalSets: Int
    var exercises: [WorkoutExercise]
}

/// One exercise section: name, plain hint lines and its sets.
nonisolated struct WorkoutExercise: Equatable, Sendable, Identifiable {
    var id: UUID
    var name: String
    /// "3 × 5 @ 100 kg" when every working set shares one target.
    var target: String?
    /// "Warm-up: 20×10 · 50×5 · 70×3 · 85×1 kg".
    var warmUp: String?
    /// "Per side: 25 + 15 · 20 kg bar".
    var plates: String?
    /// "Next time: 5 @ 102.5 kg".
    var progression: String?
    var sets: [WorkoutSetItem]
    /// The library exercise behind this slot, for "How to"; nil for a free-text exercise.
    var libraryID: UUID?
    /// The catalog entry behind the library exercise, for the thumbnail; nil when there is none.
    var catalogID: String?
    /// The unit of the weight column ("KG" or "LB" in the column header).
    var unit: WeightUnit = .kg
}

/// One set row.
nonisolated struct WorkoutSetItem: Equatable, Sendable, Identifiable {
    var id: UUID
    /// "Set 2".
    var title: String
    /// "8 @ 60 kg".
    var target: String
    /// The values saved or logged on the set ("6 @ 62.5 kg"); nil while there are none.
    var actual: String?
    var status: SetStatus
    /// The set badge: "1" for working sets, "W", "D" or "F" for warm-up, drop and failure sets.
    var badge: String = ""
    /// The weight pill: the saved or logged weight, otherwise the target ("87.5"), or "—".
    var weight: String = "—"
    /// The reps pill: the saved or logged reps, otherwise the target ("5", "8–10"), or "—".
    var reps: String = "—"
    /// The same set last time ("5 × 85"); nil when there is none.
    var previous: String?
}

/// The weight and reps editor for one set. Done saves the values only; it never logs the set.
nonisolated struct SetEditor: Equatable, Sendable, Identifiable {
    /// The set being edited.
    var id: UUID
    /// "Set 2 · Back squat".
    var title: String
    var unit: WeightUnit
    /// The weight stepper's step in `unit`.
    var step: Double
    var weight: Double
    var reps: Int
    /// The values when the editor opened, to tell whether anything changed.
    var savedWeight: Double
    var savedReps: Int
    /// "Last time 5 × 85 kg · Fri, Oct 9"; nil when there is no earlier session of the exercise.
    var lastTime: String?
    /// How many planned sets of the same kind follow this one; the "Apply to later sets" row shows when there are any.
    var laterSets: Int = 0
    /// Done also saves the weight onto the later planned sets of the same kind, each keeping its own reps.
    var appliesToLater = true

    var hasChanges: Bool { weight != savedWeight || reps != savedReps }
}

/// A short message for the toast slot. `serial` changes with every message, so the same message can show twice.
nonisolated struct WorkoutToast: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        /// A set was removed; the toast offers Undo.
        case removed(setID: UUID)
        /// A write failed.
        case failed
    }

    var serial: Int
    var kind: Kind
}
