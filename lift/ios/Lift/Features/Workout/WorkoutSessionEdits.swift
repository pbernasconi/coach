import Foundation
import LiftCore
import LiftStore

/// The Workout screen's session-level writes: Start, exercises added, moved and removed, finish, discard and Save
/// as template. Each returns the toast to show, if any; the ViewModel shows a failure. Finish, discard and its Undo
/// also keep Apple Health in step.
struct WorkoutSessionEdits {
    let sessionID: UUID
    let sessions: any SessionRepository
    let templates: any TemplateRepository
    let router: any Navigating
    let health: any WorkoutHealthRecording

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

    /// Stamps the start now; a session already started or finished stays as it is. With `movingTo`, the session moves
    /// to that day first (a workout planned for a later day, done today).
    func start(movingTo day: LocalDay? = nil) async throws -> WorkoutToast.Kind? {
        var moved: RescheduleUndo?
        if let day { moved = try await sessions.reschedule(sessionID, .move(to: day)) }
        do {
            _ = try await sessions.start(sessionID: sessionID)
        } catch {
            // A failed start leaves the workout on its planned day.
            if let moved { try? await sessions.undo(moved) }
            throw error
        }
        return nil
    }

    /// Finishes the session, opens its summary, then saves it to Apple Health when that is on (the summary asks the
    /// first time).
    func finish() async throws -> WorkoutToast.Kind? {
        _ = try await sessions.finish(sessionID: sessionID)
        router.open(.workoutSummary(sessionID))
        await health.sessionFinished(sessionID)
        return nil
    }

    /// Removes the session and the workout Lift saved for it in Apple Health, if any.
    func discard() async throws -> WorkoutToast.Kind? {
        let undo = try await sessions.reschedule(sessionID, .remove)
        await health.sessionRemoved(sessionID)
        return .discarded(undo)
    }

    /// Puts the session back, and a finished one back in Apple Health.
    func undoDiscard(_ undo: RescheduleUndo) async throws -> WorkoutToast.Kind? {
        try await sessions.undo(undo)
        await health.sessionRestored(sessionID)
        return nil
    }

    func saveAsTemplate(named name: String) async throws -> WorkoutToast.Kind? {
        let template = try await templates.saveAsTemplate(sessionID: sessionID, name: name)
        return .savedAsTemplate(name: template.name)
    }
}
