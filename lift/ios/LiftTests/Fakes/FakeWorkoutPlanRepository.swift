import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Synchronization

/// A `WorkoutPlanRepository` that records every call and answers with fixed values, or throws `error` (TEST-2).
nonisolated final class FakeWorkoutPlanRepository: WorkoutPlanRepository {
    enum Call: Equatable, Sendable {
        case createSession(UUID, on: LocalDay, unit: WeightUnit)
        case addExercise(UUID, to: UUID)
        case changeTemplate(UUID, to: UUID)
        case undoChange(TemplateChangeUndo)
        case planNextWeek(LocalDay)
        case undoPlan(WeekPlanUndo)
    }

    /// The id `createSession` hands out.
    static let sessionID = IDSequence.id(1, prefix: 0xC2)

    private let error: AppError?
    private let plannedCount: Int
    private let recorded = Mutex<[Call]>([])

    /// `plannedCount` is how many sessions `planNextWeek` says it created.
    init(error: AppError? = nil, plannedCount: Int = 2) {
        self.error = error
        self.plannedCount = plannedCount
    }

    var calls: [Call] { recorded.withLock { $0 } }

    func createSession(from templateID: UUID, on day: LocalDay, unit: WeightUnit) async throws -> SessionRecord {
        try record(.createSession(templateID, on: day, unit: unit))
        return SessionRecord(
            id: Self.sessionID,
            day: day,
            title: "Planned",
            templateID: templateID,
            unitsAtLog: unit,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    func addExercise(_ exercise: Exercise, to sessionID: UUID) async throws -> SessionExerciseRecord {
        try record(.addExercise(exercise.id, to: sessionID))
        return SessionExerciseRecord(
            id: Self.sessionID,
            sessionID: sessionID,
            slot: ExerciseSlot(exercise: exercise),
            position: 0,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    func changeTemplate(of sessionID: UUID, to templateID: UUID) async throws -> TemplateChangeUndo {
        try record(.changeTemplate(sessionID, to: templateID))
        return Self.changeUndo(sessionID)
    }

    func undo(_ change: TemplateChangeUndo) async throws { try record(.undoChange(change)) }

    func planNextWeek(from weekStart: LocalDay) async throws -> WeekPlanUndo {
        try record(.planNextWeek(weekStart))
        return WeekPlanUndo(sessionIDs: (0..<plannedCount).map { IDSequence.id(UInt64($0 + 1), prefix: 0xC3) })
    }

    func undo(_ plan: WeekPlanUndo) async throws { try record(.undoPlan(plan)) }

    /// What `changeTemplate` answers for `sessionID`.
    static func changeUndo(_ sessionID: UUID) -> TemplateChangeUndo {
        TemplateChangeUndo(
            sessionID: sessionID,
            previousTitle: "Lower A",
            previousTemplateID: nil,
            removedExerciseIDs: [],
            addedExerciseIDs: []
        )
    }

    private func record(_ call: Call) throws {
        recorded.withLock { $0.append(call) }
        if let error { throw error }
    }
}
