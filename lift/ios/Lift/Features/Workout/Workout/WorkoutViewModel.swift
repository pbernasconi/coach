import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class WorkoutViewModel {
    private(set) var state = WorkoutState()

    private let sessionID: UUID
    private let sessions: any SessionRepository
    private let sets: any SetRepository
    private let clock: any Clock<Duration>
    private let days: DayCalendar
    /// The latest session from the store; the source for the editor, Add set and rest times.
    @ObservationIgnored private var detail: SessionDetail?
    /// Sets with a log, unlog or skip on the way, so a double tap writes once.
    @ObservationIgnored private var inFlight: Set<UUID> = []
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessionID: UUID,
        sessions: any SessionRepository,
        sets: any SetRepository,
        clock: any Clock<Duration>,
        calendar: Calendar
    ) {
        self.sessionID = sessionID
        self.sessions = sessions
        self.sets = sets
        self.clock = clock
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes the session; started by the Screen's `.task` (SCR-4).
    func run() async {
        for await detail in sessions.observeSession(id: sessionID) {
            self.detail = detail
            if let detail {
                state.workout = .loaded(WorkoutOverview(detail: detail, days: days))
            } else {
                state.workout = .empty
                state.editor = nil
            }
        }
    }

    /// Counts the rest down once a second on the injected clock. The Screen restarts it for each new rest
    /// (`.task(id: state.rest?.run)`), and cancelling it stops the countdown.
    func runRestTimer() async {
        while let rest = state.rest {
            do {
                try await clock.sleep(for: .seconds(1))
            } catch {
                return
            }
            guard let current = state.rest, current.run == rest.run else { return }
            state.rest = current.ticked()
        }
    }

    @discardableResult
    func send(_ action: WorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .setLogTapped(let id): toggleLog(id)
        case .setValuesTapped(let id): openEditor(id)
        case .setSkipTapped(let id): skip(id)
        case .setRemoveTapped(let id): remove(id)
        case .removeUndoTapped(let id): write { try await $0.restore(setID: id) }
        case .addSetTapped(let exerciseID): addSet(to: exerciseID)
        default: sendLocal(action)
        }
    }

    /// The actions that only change what is on screen: the editor and the rest timer.
    private func sendLocal(_ action: WorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .editorWeightChanged(let weight): state.editor?.weight = max(0, weight)
        case .editorRepsChanged(let reps): state.editor?.reps = max(0, reps)
        case .editorDoneTapped: return saveEditor()
        case .editorDismissed: state.editor = nil
        case .restExtendTapped: state.rest = state.rest?.extended(by: RestTimer.extensionSeconds)
        case .restSkipTapped: state.rest = nil
        default: break
        }
        return nil
    }

    // MARK: Logging

    /// One tap logs a planned set; a logged or skipped set goes back to planned.
    private func toggleLog(_ id: UUID) -> Task<Void, Never>? {
        guard case (let item, let set)? = find(id), !inFlight.contains(id) else { return nil }
        inFlight.insert(id)
        let isPlanned = set.status == .planned
        let restSeconds = item.exercise.restSeconds ?? RestTimer.defaultSeconds
        return Task {
            defer { inFlight.remove(id) }
            do {
                if isPlanned {
                    _ = try await sets.log(setID: id)
                    startRest(seconds: restSeconds)
                } else {
                    _ = try await sets.unlog(setID: id)
                }
            } catch {
                showToast(.failed)
            }
        }
    }

    private func skip(_ id: UUID) -> Task<Void, Never>? {
        guard find(id) != nil, !inFlight.contains(id) else { return nil }
        inFlight.insert(id)
        return Task {
            defer { inFlight.remove(id) }
            do {
                _ = try await sets.skip(setID: id)
            } catch {
                showToast(.failed)
            }
        }
    }

    private func remove(_ id: UUID) -> Task<Void, Never>? {
        guard find(id) != nil else { return nil }
        if state.editor?.id == id { state.editor = nil }
        return Task {
            do {
                try await sets.remove(setID: id)
                showToast(.removed(setID: id))
            } catch {
                showToast(.failed)
            }
        }
    }

    private func addSet(to exerciseID: UUID) -> Task<Void, Never>? {
        guard let item = detail?.items.first(where: { $0.id == exerciseID }) else { return nil }
        let last = item.sets.last { $0.kind == .working } ?? item.sets.last
        let target = last?.target ?? .none
        return write { _ = try await $0.addSet(to: exerciseID, kind: .working, target: target) }
    }

    // MARK: Editor

    private func openEditor(_ id: UUID) -> Task<Void, Never>? {
        guard case (let item, let set)? = find(id) else { return nil }
        let row = WorkoutExercise(item: item, unit: set.unit).sets.first { $0.id == id }
        let title = [row?.title, item.exercise.displayName].compactMap(\.self).joined(separator: " · ")
        state.editor = SetEditor(set: set, title: title)
        return nil
    }

    /// Done: saves weight and reps through `saveValues` only. It never logs the set (product rule).
    private func saveEditor() -> Task<Void, Never>? {
        guard let editor = state.editor else { return nil }
        state.editor = nil
        let weight = editor.weight > 0 ? Weight(editor.weight, editor.unit) : nil
        let reps = editor.reps > 0 ? editor.reps : nil
        return write { _ = try await $0.saveValues(setID: editor.id, reps: reps, weight: weight) }
    }

    // MARK: Rest

    private func startRest(seconds: Int) {
        let run = (state.rest?.run ?? 0) + 1
        state.rest = seconds > 0 ? RestTimer(run: run, seconds: seconds) : nil
    }

    // MARK: Support

    private func find(_ setID: UUID) -> (SessionDetail.Item, SetRecord)? {
        for item in detail?.items ?? [] {
            if let set = item.sets.first(where: { $0.id == setID }) { return (item, set) }
        }
        return nil
    }

    /// Runs one write; a failure shows the "could not save" toast.
    private func write(_ body: @escaping (any SetRepository) async throws -> Void) -> Task<Void, Never> {
        let sets = sets
        return Task {
            do {
                try await body(sets)
            } catch {
                showToast(.failed)
            }
        }
    }

    private func showToast(_ kind: WorkoutToast.Kind) {
        serial += 1
        state.toast = WorkoutToast(serial: serial, kind: kind)
    }
}
