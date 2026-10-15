import Foundation
import LiftCore
import LiftStore

/// The session-level actions: add, move and remove exercises, finish, discard, Save as template. Each write goes
/// through `WorkoutSessionEdits`; the toast it returns (or the failure) is shown here.
extension WorkoutViewModel {
    /// One session write; it returns the toast to show, if any.
    typealias SessionWrite = (WorkoutSessionEdits) async throws -> WorkoutToast.Kind?

    func sendSession(_ action: WorkoutAction) -> Task<Void, Never>? {
        guard let detail else { return nil }
        switch action {
        case .addExerciseTapped: edits.router.open(.exercisePicker(.session(detail.id)))
        case .summaryTapped: edits.router.open(.workoutSummary(detail.id))
        default: return sessionWrite(for: action, detail: detail).flatMap(perform)
        }
        return nil
    }

    /// The session write an action asks for, if any.
    private func sessionWrite(for action: WorkoutAction, detail: SessionDetail) -> SessionWrite? {
        switch action {
        case .exerciseMoveUpTapped(let id): return { try await $0.move(id, by: -1, in: detail) }
        case .exerciseMoveDownTapped(let id): return { try await $0.move(id, by: 1, in: detail) }
        case .exerciseRemoveTapped(let id): return { try await $0.remove(id) }
        case .exerciseRemoveUndoTapped(let id): return { try await $0.restore(id) }
        case .finishTapped: return { try await $0.finish() }
        case .discardTapped: return { try await $0.discard() }
        case .discardUndoTapped(let undo): return { try await $0.undoDiscard(undo) }
        case .saveAsTemplateTapped:
            let name = detail.session.title
            return { try await $0.saveAsTemplate(named: name) }
        default: return nil
        }
    }

    /// The options sheet to open for `action`, from the current session.
    func options(for action: WorkoutAction) -> WorkoutOptions? {
        guard let detail else { return nil }
        switch action {
        case .workoutOptionsTapped: return .workout(title: detail.session.title)
        case .exerciseOptionsTapped(let id):
            return WorkoutExerciseOptions(detail: detail, exerciseID: id).map { .exercise($0) }
        default: return nil
        }
    }

    /// Runs one session write; a toast it returns is shown, and a failure shows "could not save". One at a time, so a
    /// double tap writes once (SCR-5).
    private func perform(_ body: @escaping (WorkoutSessionEdits) async throws -> WorkoutToast.Kind?) -> Task<
        Void, Never
    >? {
        guard !isEditingSession else { return nil }
        isEditingSession = true
        let edits = edits
        return Task {
            defer { isEditingSession = false }
            do {
                if let toast = try await body(edits) { showToast(toast) }
            } catch {
                showToast(.failed)
            }
        }
    }
}
