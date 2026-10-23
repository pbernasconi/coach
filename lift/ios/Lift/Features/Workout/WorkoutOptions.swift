import Foundation
import LiftCore
import LiftStore

/// The Workout screen's options sheets: the workout's own, or one exercise's.
nonisolated enum WorkoutOptions: Equatable, Sendable {
    /// Add or edit the workout's note, Save as template and Discard workout.
    case workout(title: String, hasNote: Bool)
    case exercise(WorkoutExerciseOptions)
}

/// One exercise's options: add or edit its note, move it up or down, or remove it.
nonisolated struct WorkoutExerciseOptions: Equatable, Sendable, Identifiable {
    var id: UUID
    var name: String
    var canMoveUp: Bool
    var canMoveDown: Bool
    /// True when the exercise has a note, so the sheet says "Edit note" instead of "Add note".
    var hasNote = false

    /// The options for the exercise `id` of `detail`; nil when it has no such exercise.
    init?(detail: SessionDetail, exerciseID id: UUID) {
        guard let index = detail.items.firstIndex(where: { $0.id == id }) else { return nil }
        self.init(
            id: id,
            name: detail.items[index].exercise.displayName,
            canMoveUp: index > 0,
            canMoveDown: index < detail.items.count - 1,
            hasNote: NoteText.normalized(detail.items[index].exercise.note) != nil
        )
    }

    init(id: UUID, name: String, canMoveUp: Bool, canMoveDown: Bool, hasNote: Bool = false) {
        self.id = id
        self.name = name
        self.canMoveUp = canMoveUp
        self.canMoveDown = canMoveDown
        self.hasNote = hasNote
    }
}

extension WorkoutOverview {
    /// The header's first line: "Thursday, 5 March", then "Finished" and the time it took once it is finished (the
    /// start shows beside the running clock).
    var dayLine: String {
        var parts = [dayTitle]
        if isFinished { parts.append(String(localized: "Finished")) }
        if let durationText { parts.append(durationText) }
        return parts.joined(separator: " · ")
    }
}

extension DayCalendar {
    /// "Started 9:05": the time in the calendar's zone and locale.
    func started(at date: Date) -> String {
        var style = Date.FormatStyle(date: .omitted, time: .shortened)
        style.timeZone = calendar.timeZone
        style.locale = calendar.locale ?? .current
        style.calendar = calendar
        return String(localized: "Started \(date.formatted(style))")
    }
}
