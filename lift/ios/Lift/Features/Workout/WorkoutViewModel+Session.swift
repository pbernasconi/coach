import Foundation
import LiftCore
import LiftStore

/// The session-level actions: Start, add, move and remove exercises, finish, discard, Save as template. Each
/// write goes through `WorkoutSessionEdits`; the toast it returns (or the failure) is shown here.
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
            let today = startMove?.today
            return perform { try await $0.undoDiscard(undo, movingTo: today) }
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
        case .startTapped:
            // Starting a workout planned for a later day does it today: it moves here first (the plan follows).
            let day = today
            let moveTo = detail.session.day > day && detail.session.startedAt == nil ? day : nil
            if let moveTo { startMove = (planned: detail.session.day, today: moveTo) }
            return { try await $0.start(movingTo: moveTo) }
        case .finishTapped:
            send(.restSkipTapped)  // a finished workout has no rest left, here or on the Lock Screen,
            send(.restReadyDismissed)  // and no "rest over" bar for a next set
            return { try await $0.finish() }
        case .discardTapped:
            hasDiscarded = true  // keeps the page as it was while it closes
            // A workout Start moved here from a later day goes back to that day, and its plan workout with it.
            let planned = startMove?.planned
            return { try await $0.discard(movingBackTo: planned) }
        case .saveAsTemplateTapped:
            let name = detail.session.title
            return { try await $0.saveAsTemplate(named: name) }
        default: return nil
        }
    }

    /// The first logged set starts a workout nobody started with Start, unless the session is on an earlier day (then
    /// Finish takes the first logged set's time, as before). A failure is left alone: the clock reads the first logged
    /// set's time until the start is stored, and Finish stores it too.
    func startIfNeeded() async {
        guard let session = detail?.session, session.startedAt == nil, session.finishedAt == nil,
            case .loaded(let workout) = state.workout, !workout.isPastDay
        else { return }
        _ = try? await edits.sessions.start(sessionID: session.id)
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
