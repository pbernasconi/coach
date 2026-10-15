import Foundation
import LiftCore
import LiftStore

/// What an import wrote so far. Every count is of rows that reached the database (and so the outbox).
nonisolated struct ImportTally: Equatable, Sendable {
    /// Workouts written in full.
    var sessions = 0
    /// Sets written, including those of a workout the import stopped inside.
    var sets = 0
    /// Of `sets`, the ones logged as done.
    var loggedSets = 0
    /// Library exercises created for names that matched none.
    var newExercises = 0
    /// The title of the workout the import stopped inside, when it stopped part-way through one.
    var incompleteSession: String?
}

/// How an import ended.
nonisolated enum ImportEnding: Equatable, Sendable {
    case finished
    case cancelled
    case failed(AppError.Kind)
}

/// Writes reviewed workouts through the normal repositories, so each row is one transaction with an outbox entry
/// (DATA-3) and syncs like anything logged by hand. Checks for cancellation before every write. One writer per
/// import: it remembers the exercises it created so a name used twice is created once.
final class ImportWriter {
    private let sessions: any SessionRepository
    private let sets: any SetRepository
    private let exercises: any ExerciseRepository
    private let onProgress: (ImportTally) -> Void
    private(set) var tally = ImportTally()
    private var created: [String: UUID] = [:]

    init(
        sessions: any SessionRepository,
        sets: any SetRepository,
        exercises: any ExerciseRepository,
        onProgress: @escaping (ImportTally) -> Void
    ) {
        self.sessions = sessions
        self.sets = sets
        self.exercises = exercises
        self.onProgress = onProgress
    }

    /// Writes `plan` in order and says how it ended; `tally` holds what was written either way.
    func write(_ plan: [Session]) async -> ImportEnding {
        do {
            for session in plan {
                try await write(session)
            }
            return .finished
        } catch is CancellationError {
            return .cancelled
        } catch let error as AppError {
            return .failed(error.kind)
        } catch {
            return .failed(.unknown)
        }
    }

    private func write(_ session: Session) async throws {
        try Task.checkCancellation()
        let record = try await sessions.createSession(
            on: session.date,
            title: session.title,
            unit: session.unitsAtLog,
            templateID: nil
        )
        tally.incompleteSession = session.title
        for exercise in session.exercises {
            try await write(exercise, to: record.id)
        }
        tally.incompleteSession = nil
        tally.sessions += 1
        onProgress(tally)
    }

    private func write(_ exercise: SessionExercise, to sessionID: UUID) async throws {
        try Task.checkCancellation()
        let exerciseID = try await libraryID(for: exercise)
        let slot = ExerciseSlot(
            exerciseID: exerciseID,
            displayName: exercise.displayName,
            loadMode: exercise.loadMode,
            equipment: exercise.equipment,
            restSeconds: exercise.restSeconds,
            note: exercise.note,
            supersetGroup: exercise.supersetGroup
        )
        let item = try await sessions.addExercise(slot, to: sessionID)
        for set in exercise.sets {
            try await write(set, to: item.id)
        }
    }

    /// Adds the set with its target; a done set then gets its actual values and is logged, a skipped one is
    /// skipped, and a planned one (today's unchecked sets) stays planned.
    private func write(_ set: LoggedSet, to sessionExerciseID: UUID) async throws {
        try Task.checkCancellation()
        let record = try await sets.addSet(to: sessionExerciseID, kind: set.kind, target: set.target)
        tally.sets += 1
        if set.isDone, let actual = set.actual {
            try Task.checkCancellation()
            _ = try await sets.saveValues(setID: record.id, reps: actual.reps, weight: actual.weight)
            _ = try await sets.log(setID: record.id)
            tally.loggedSets += 1
        } else if set.isSkipped {
            try Task.checkCancellation()
            _ = try await sets.skip(setID: record.id)
        }
        onProgress(tally)
    }

    /// The matched library id, or a new library exercise for an unmatched name (created once per name).
    private func libraryID(for exercise: SessionExercise) async throws -> UUID {
        if let id = exercise.exerciseID { return id }
        let key = ExerciseMatcher.normalizedName(exercise.displayName)
        if let id = created[key] { return id }
        try Task.checkCancellation()
        let made = try await exercises.create(
            name: exercise.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            equipment: exercise.equipment ?? .other,
            loadMode: exercise.loadMode,
            primary: [],
            secondary: []
        )
        created[key] = made.id
        tally.newExercises += 1
        return made.id
    }
}
