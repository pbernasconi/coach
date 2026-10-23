import Foundation
import LiftCore

/// What `WorkoutPlanRepository.undo(_:)` needs to put a session back on its old workout.
public struct TemplateChangeUndo: Hashable, Sendable {
    public let sessionID: UUID
    public let previousTitle: String
    public let previousTemplateID: UUID?
    /// The session exercises the change removed, restored by the undo.
    public let removedExerciseIDs: [UUID]
    /// The session exercises the change added, removed by the undo.
    public let addedExerciseIDs: [UUID]

    public init(
        sessionID: UUID,
        previousTitle: String,
        previousTemplateID: UUID?,
        removedExerciseIDs: [UUID],
        addedExerciseIDs: [UUID]
    ) {
        self.sessionID = sessionID
        self.previousTitle = previousTitle
        self.previousTemplateID = previousTemplateID
        self.removedExerciseIDs = removedExerciseIDs
        self.addedExerciseIDs = addedExerciseIDs
    }
}

/// What `WorkoutPlanRepository.undo(_:)` needs to take back a planned week.
public struct WeekPlanUndo: Hashable, Sendable {
    /// The sessions the plan created; empty when every day was taken.
    public let sessionIDs: [UUID]

    public init(sessionIDs: [UUID]) {
        self.sessionIDs = sessionIDs
    }
}

/// One exercise of a coach's planned strength workout: a library exercise, its sets and reps, and the coach's words.
public struct CoachExercise: Hashable, Sendable {
    public var exercise: Exercise
    public var sets: Int
    public var repRange: ClosedRange<Int>
    public var note: String?

    public init(exercise: Exercise, sets: Int, repRange: ClosedRange<Int>, note: String? = nil) {
        self.exercise = exercise
        self.sets = sets
        self.repRange = repRange
        self.note = note
    }
}

/// Planning sessions from templates. Every planned set's target comes from the template slot, upgraded by
/// `SlotPlanner` from the exercise's last logged session. Each call is one transaction with one outbox entry per row
/// (DATA-3).
public protocol WorkoutPlanRepository: Sendable {
    /// A planned session on `day` with the template's name, exercises and sets.
    func createSession(from templateID: UUID, on day: LocalDay, unit: WeightUnit) async throws -> SessionRecord

    /// A planned session on `day` named `title` with `exercises`, as a coach's planned strength workout lists them.
    /// No template.
    func createSession(titled title: String, on day: LocalDay, unit: WeightUnit, exercises: [CoachExercise])
        async throws -> SessionRecord

    /// Appends a library exercise to a live session with its planned sets: as many as last time with the target
    /// progression suggests, or 3 × 8–12 when it was never logged.
    func addExercise(_ exercise: Exercise, to sessionID: UUID) async throws -> SessionExerciseRecord

    /// Replaces a session's exercises with another template's and takes its name. A session with a logged set
    /// cannot change (`AppError(.conflict)`).
    func changeTemplate(of sessionID: UUID, to templateID: UUID) async throws -> TemplateChangeUndo

    /// Puts the old exercises, name and template back and removes the added ones.
    func undo(_ change: TemplateChangeUndo) async throws

    /// Copies each template session of the week starting `weekStart` to the same weekday a week later, skipping days
    /// that already have a session and templates that were removed.
    func planNextWeek(from weekStart: LocalDay) async throws -> WeekPlanUndo

    /// Removes the sessions `planNextWeek` created.
    func undo(_ plan: WeekPlanUndo) async throws
}
