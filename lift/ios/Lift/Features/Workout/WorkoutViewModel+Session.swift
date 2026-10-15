import Foundation
import LiftCore
import LiftStore

/// The session-level actions: add, move and remove exercises, finish, discard, Save as template. Each write goes
/// through `WorkoutSessionEdits`; the toast it returns (or the failure) is shown here.
extension WorkoutViewModel {
    /// One session write; it returns the toast to show, if any.
    typealias SessionWrite = (WorkoutSessionEdits) async throws -> WorkoutToast.Kind?

    func sendSession(_ action: WorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .discardedToastShown:
            edits.router.back()  // back to where the workout was opened; the toast with Undo stays up there
            return nil
        case .discardUndoTapped(let undo):
            // The session is gone from the store until this runs, so it cannot wait for `detail`.
            hasDiscarded = false
            return perform { try await $0.undoDiscard(undo) }
        default:
            break
        }
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
        case .discardTapped:
            hasDiscarded = true  // keeps the page as it was while it closes
            return { try await $0.discard() }
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

/// Set writes that need no state of their own.
extension WorkoutViewModel {
    /// Adds a set to the exercise, copying its last working set's target.
    func addSet(to exerciseID: UUID) -> Task<Void, Never>? {
        guard let item = detail?.items.first(where: { $0.id == exerciseID }) else { return nil }
        let last = item.sets.last { $0.kind == .working } ?? item.sets.last
        let target = last?.target ?? .none
        return write { _ = try await $0.addSet(to: exerciseID, kind: .working, target: target) }
    }

    /// Runs one write; a failure shows the "could not save" toast.
    func write(_ body: @escaping (any SetRepository) async throws -> Void) -> Task<Void, Never> {
        let sets = sets
        return Task {
            do {
                try await body(sets)
            } catch {
                showToast(.failed)
            }
        }
    }
}
