import Foundation
import LiftCore
import LiftStore

/// The Workout screen's session-level writes: exercises added, moved and removed, finish, discard and Save as
/// template. Each returns the toast to show, if any; the ViewModel shows a failure.
struct WorkoutSessionEdits {
    let sessionID: UUID
    let sessions: any SessionRepository
    let templates: any TemplateRepository
    let router: any Navigating

    /// Moves the exercise `id` one place up (`offset` -1) or down (+1).
    func move(_ id: UUID, by offset: Int, in detail: SessionDetail) async throws -> WorkoutToast.Kind? {
        var ids = detail.items.map(\.id)
        guard let index = ids.firstIndex(of: id), ids.indices.contains(index + offset) else { return nil }
        ids.swapAt(index, index + offset)
        try await sessions.reorderExercises(in: sessionID, ids: ids)
        return nil
    }

    func remove(_ id: UUID) async throws -> WorkoutToast.Kind? {
        try await sessions.removeExercise(id: id)
        return .exerciseRemoved(id)
    }

    func restore(_ id: UUID) async throws -> WorkoutToast.Kind? {
        try await sessions.restoreExercise(id: id)
        return nil
    }

    /// Finishes the session, then opens its summary.
    func finish() async throws -> WorkoutToast.Kind? {
        _ = try await sessions.finish(sessionID: sessionID)
        router.open(.workoutSummary(sessionID))
        return nil
    }

    func discard() async throws -> WorkoutToast.Kind? {
        .discarded(try await sessions.reschedule(sessionID, .remove))
    }

    func undoDiscard(_ undo: RescheduleUndo) async throws -> WorkoutToast.Kind? {
        try await sessions.undo(undo)
        return nil
    }

    func saveAsTemplate(named name: String) async throws -> WorkoutToast.Kind? {
        let template = try await templates.saveAsTemplate(sessionID: sessionID, name: name)
        return .savedAsTemplate(name: template.name)
    }
}
