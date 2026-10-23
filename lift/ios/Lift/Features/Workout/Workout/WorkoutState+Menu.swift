import Foundation
import LiftCore
import LiftStore

/// The reorder sheet: the session's exercises in the order being set. Done saves it; logged sets stay with their
/// exercise.
nonisolated struct ExerciseReorder: Equatable, Sendable, Identifiable {
    nonisolated struct Row: Equatable, Sendable, Identifiable {
        var id: UUID
        var name: String
        /// "1 of 3 sets logged" or "3 sets".
        var detail: String
        /// The exercise holds the set to do now.
        var isCurrent: Bool
    }

    var rows: [Row]
    /// The order when the sheet opened, to tell whether anything moved.
    var savedIDs: [UUID]

    var id: String { "reorder" }
    var ids: [UUID] { rows.map(\.id) }
    var hasChanges: Bool { ids != savedIDs }

    init(rows: [Row]) {
        self.rows = rows
        savedIDs = rows.map(\.id)
    }

    /// The session's exercises, marking the one that holds `currentSetID`.
    init(workout: WorkoutOverview, currentSetID: UUID?) {
        self.init(
            rows: workout.exercises.map { exercise in
                let logged = exercise.sets.count(where: { $0.status != .planned })
                let total = exercise.sets.count
                return Row(
                    id: exercise.id,
                    name: exercise.name,
                    detail: logged > 0
                        ? String(localized: "\(logged) of \(total) sets logged")
                        : String(AttributedString(localized: "^[\(total) set](inflect: true)").characters),
                    isCurrent: exercise.sets.contains { $0.id == currentSetID }
                )
            }
        )
    }

    func moved(from source: IndexSet, to destination: Int) -> ExerciseReorder {
        var next = self
        let moving = source.compactMap { rows.indices.contains($0) ? rows[$0] : nil }
        var staying = rows.indices.filter { !source.contains($0) }.map { rows[$0] }
        let place = destination - source.count(where: { $0 < destination })
        staying.insert(contentsOf: moving, at: min(max(0, place), staying.count))
        next.rows = staying
        return next
    }
}

/// Workout settings: this workout's name, start and paused time, and the defaults for every workout. The start and the
/// defaults save as they change; the name saves on Done.
nonisolated struct WorkoutSettingsSheet: Equatable, Sendable, Identifiable {
    var title: String
    var savedTitle: String
    /// When the workout started; nil before it did (the start row is hidden then).
    var startedAt: Date?
    /// The latest start that can be picked: the finish, or now.
    var latestStart: Date
    /// Seconds paused so far, running pause included; 0 hides the row.
    var pausedSeconds: Int
    var preferences: WorkoutPreferences

    var id: String { "workout-settings" }
    var hasChanges: Bool { title != savedTitle }

    /// The earliest start that can be picked, 12 hours before the latest (the clock's own limit).
    var earliestStart: Date { latestStart.addingTimeInterval(-TimeInterval(WorkoutClock.limit)) }

    /// "3 min" or "45 s".
    var pausedText: String {
        let format = Duration.UnitsFormatStyle(allowedUnits: [.hours, .minutes, .seconds], width: .abbreviated)
        return Duration.seconds(pausedSeconds).formatted(format)
    }

    init(workout: WorkoutOverview, preferences: WorkoutPreferences, now: Date) {
        title = workout.title
        savedTitle = workout.title
        startedAt = workout.startedAt
        latestStart = workout.finishedAt ?? now
        let running = workout.pausedAt.map { WorkoutClock.seconds(from: $0, to: now) } ?? 0
        pausedSeconds = workout.pausedSeconds + running
        self.preferences = preferences
    }
}

extension WorkoutState {
    /// The screen stays on while the workout runs (started, not finished), when Workout settings say so.
    var keepsScreenAwake: Bool {
        guard preferences.keepsScreenAwake, case .loaded(let workout) = workout else { return false }
        return workout.startedAt != nil && !workout.isFinished
    }

    /// The haptics at the end of a rest play unless Workout settings turned rest alerts off.
    var playsRestHaptics: Bool { preferences.restAlert != .off }
}

extension WorkoutState {
    /// Opens, changes and closes the reorder and settings sheets; the writes behind their Done and the start picker are
    /// the ViewModel's.
    mutating func applyMenu(_ action: WorkoutAction, preferences: WorkoutPreferences, now: Date) {
        switch action {
        case .reorderTapped:
            options = nil
            guard case .loaded(let workout) = workout else { return }
            reorder = ExerciseReorder(workout: workout, currentSetID: dock?.content?.current?.id)
        case .reorderMoved(let source, let destination):
            reorder = reorder?.moved(from: source, to: destination)
        case .reorderDoneTapped, .reorderDismissed:
            reorder = nil
        case .settingsTapped:
            options = nil
            guard case .loaded(let workout) = workout else { return }
            settings = WorkoutSettingsSheet(workout: workout, preferences: preferences, now: now)
        case .settingsTitleChanged(let title):
            settings?.title = title
        case .settingsDoneTapped, .settingsDismissed:
            settings = nil
        default:
            break
        }
    }
}
