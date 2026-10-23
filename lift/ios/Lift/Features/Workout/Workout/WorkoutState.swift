import Foundation
import LiftCore
import LiftStore

/// Everything the Workout screen renders. Exclusive states are enums or optionals (SCR-6).
nonisolated struct WorkoutState: Equatable, Sendable {
    /// The session; `.empty` once it was removed or if it never existed.
    var workout: Loadable<WorkoutOverview> = .loading
    /// The weight and reps editor, while it is open.
    var editor: SetEditor?
    /// The note editor for the session or one exercise, while it is open.
    var noteEditor: NoteEditor?
    /// The rest countdown after a set was logged.
    var rest: RestTimer?
    /// The rest ran out: the next set is up. Only while `rest` is nil; logging any set or closing the bar clears it.
    var ready: RestReady?
    /// The latest message for the toast slot.
    var toast: WorkoutToast?
    /// Exercise stills by catalog id, loaded as their sections appear.
    var thumbnails: [String: MediaImage] = [:]
    /// The latest earlier session of each library exercise, by library exercise id, read once when the session loads.
    var previous: [UUID: PreviousSets] = [:]
    /// The open options sheet: the workout's, or one exercise's.
    var options: WorkoutOptions?
    /// The reorder sheet, while it is open.
    var reorder: ExerciseReorder?
    /// Workout settings, while the sheet is open.
    var settings: WorkoutSettingsSheet?
    /// The defaults for every workout, as last read: the rest haptics and keeping the screen awake follow them.
    var preferences = WorkoutPreferences()
}

/// The session header and its exercises in order.
nonisolated struct WorkoutOverview: Equatable, Sendable {
    var title: String
    /// "Thursday, 5 March".
    var dayTitle: String
    var loggedSets: Int
    var totalSets: Int
    var exercises: [WorkoutExercise]
    /// What was written for the whole session ("Short on time"); nil when nothing was.
    var note: String?
    /// What was written about the session's warm-up ("5 min rower"); nil when nothing was.
    var warmUpNote: String?
    /// "Started 9:05": the start, or the first logged set's time; nil before anything was logged.
    var started: String?
    /// When the workout started: the stamped start, or the first logged set's time; nil before either. The header
    /// clock counts from it, so it stays right after the app was in the background or relaunched.
    var startedAt: Date?
    /// When the workout was finished; nil while it is not.
    var finishedAt: Date?
    /// The session's day is before today (opened from History): no Start button, and logging does not stamp a start.
    var isPastDay = false
    /// The session's day is after today (a workout planned ahead): a set's check does not log it until Start moves the
    /// workout to today, so a stray tap never marks a later workout done.
    var isFutureDay = false
    /// When the running pause started; nil while the workout is not paused. The clock stops there.
    var pausedAt: Date?
    /// Whole seconds of the pauses already ended, left out of the clock and the length.
    var pausedSeconds = 0

    var isFinished: Bool { finishedAt != nil }
    var isPaused: Bool { pausedAt != nil && !isFinished }
}

/// One exercise section: name, plain hint lines and its sets.
nonisolated struct WorkoutExercise: Equatable, Sendable, Identifiable {
    var id: UUID
    var name: String
    /// "3 × 5 @ 100 kg" when every working set shares one target.
    var target: String?
    /// "Warm-up: 20×10 · 50×5 · 70×3 · 85×1 kg".
    var warmUp: String?
    /// "Next time: 5 @ 102.5 kg".
    var progression: String?
    var sets: [WorkoutSetItem]
    /// The library exercise behind this slot, for "How to"; nil for a free-text exercise.
    var libraryID: UUID?
    /// The catalog entry behind the library exercise, for the thumbnail; nil when there is none.
    var catalogID: String?
    /// The unit of the weight column ("KG" or "LB" in the column header).
    var unit: WeightUnit = .kg
    /// What was written about the exercise ("Elbows in"), without a next-time line `progression` already shows. It shows
    /// on the exercise's How to page, not in the list.
    var note: String?
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
    /// What was written about this set ("paused"); nil when nothing was.
    var note: String?
    /// The set's effort ("RPE 8.5"); nil when it was not recorded.
    var rpe: String?
}

/// The weight, reps, RPE and note editor for one set. Done saves them; it never logs the set.
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
    /// The chosen RPE on the `RPE` scale; nil when none is chosen.
    var rpe: Double?
    /// The set's note as typed.
    var note = ""
    /// The RPE and note when the editor opened.
    var savedRPE: Double?
    var savedNote = ""
    /// The plates behind the weight, for a barbell or a lift written per side; nil for other lifts.
    var plates: EditorPlates?

    /// The plates the weight on the stepper needs, and the change from what is loaded now.
    var loading: PlateLoading? { plates?.loading(for: weight) }

    var hasValueChanges: Bool { weight != savedWeight || reps != savedReps }
    var hasDetailChanges: Bool { rpe != savedRPE || note != savedNote }
    var hasChanges: Bool { hasValueChanges || hasDetailChanges }
}

/// The note editor for the whole session or one exercise. Done saves the text; an empty text clears the note.
nonisolated struct NoteEditor: Equatable, Sendable, Identifiable {
    enum Target: Hashable, Sendable {
        case session(UUID)
        case exercise(UUID)
    }

    var target: Target
    /// "Workout note" or "Note · Back squat".
    var title: String
    var text: String
    /// The text when the editor opened.
    var savedText: String

    var id: Target { target }
    var hasChanges: Bool { text != savedText }
}

/// A short message for the toast slot. `serial` changes with every message, so the same message can show twice.
nonisolated struct WorkoutToast: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        /// A set was removed; the toast offers Undo.
        case removed(setID: UUID)
        /// An exercise was removed; the toast offers Undo.
        case exerciseRemoved(UUID)
        /// The session was discarded; the toast offers Undo.
        case discarded(RescheduleUndo)
        /// A template was made from the session.
        case savedAsTemplate(name: String)
        /// A set's check on a workout planned for a later day ("Friday, October 23"): nothing was logged.
        case plannedLater(day: String)
        /// A write failed.
        case failed
    }

    var serial: Int
    var kind: Kind
}
