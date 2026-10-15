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
    private let router: any Navigating
    private let clock: any Clock<Duration>
    /// The rest's wall-clock end and its Live Activity.
    private let restActivity: RestActivitySession
    /// The catalog, for exercise thumbnails.
    private let catalog: any ExerciseCatalogProviding
    /// Each library exercise's sets last time, read once when the session first loads.
    private let previousSets: PreviousSetsLoader
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
        router: any Navigating,
        clock: any Clock<Duration>,
        restActivity: any RestActivityController,
        catalog: any ExerciseCatalogProviding,
        history: any ExerciseHistoryRepository,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.sessionID = sessionID
        self.sessions = sessions
        self.sets = sets
        self.router = router
        self.clock = clock
        self.restActivity = RestActivitySession(controller: restActivity, now: now)
        self.catalog = catalog
        self.previousSets = PreviousSetsLoader(history: history)
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes the session; started by the Screen's `.task` (SCR-4). The first time the session loads, it also reads
    /// each exercise's sets last time, once.
    func run() async {
        var hasReadPrevious = false
        for await detail in sessions.observeSession(id: sessionID) {
            self.detail = detail
            guard let detail else {
                state.workout = .empty
                state.editor = nil
                continue
            }
            show(detail)
            if !hasReadPrevious {
                hasReadPrevious = true
                state.previous = await previousSets.load(for: detail)
                show(detail)
            }
        }
    }

    private func show(_ detail: SessionDetail) {
        state.workout = .loaded(WorkoutOverview(detail: detail, days: days, previous: state.previous))
    }

    /// Counts the rest down once a second on the injected clock. The Screen restarts it for each new rest
    /// (`.task(id: state.rest?.run)`), and cancelling it stops the countdown. Each tick also catches up with the wall
    /// clock, so the bar matches the Live Activity after the app was in the background. Reaching zero ends the rest.
    func runRestTimer() async {
        while let rest = state.rest {
            do {
                try await clock.sleep(for: .seconds(1))
            } catch {
                return
            }
            guard let current = state.rest, current.run == rest.run else { return }
            state.rest = current.ticked()?.capped(at: restActivity.secondsLeft)
            if state.rest == nil { endRest() }
        }
    }

    @discardableResult
    func send(_ action: WorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .setLogTapped(let id): toggleLog(id)
        case .setSkipTapped(let id): skip(id)
        case .setRemoveTapped(let id): remove(id)
        case .removeUndoTapped(let id): write { try await $0.restore(setID: id) }
        case .addSetTapped(let exerciseID): addSet(to: exerciseID)
        default: sendLocal(action)
        }
    }

    /// The actions that only change what is on screen or where it goes: the editor, the rest timer, "How to".
    private func sendLocal(_ action: WorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .setValuesTapped(let id): openEditor(id)
        case .editorWeightChanged, .editorRepsChanged, .editorApplyToLaterChanged, .editorDismissed:
            state.editor = state.editor?.applying(action)
        case .editorDoneTapped: return saveEditor()
        case .restExtendTapped: extendRest()
        case .restSkipTapped: endRest()
        case .howToTapped(let exerciseID): router.open(.exercise(exerciseID))
        case .thumbnailNeeded(let catalogID): return loadThumbnail(catalogID)
        default: break
        }
        return nil
    }

    // MARK: Logging

    /// One tap logs a planned set; a logged or skipped set goes back to planned.
    private func toggleLog(_ id: UUID) -> Task<Void, Never>? {
        guard case (let item, let set)? = detail?.find(setID: id), !inFlight.contains(id) else { return nil }
        inFlight.insert(id)
        let isPlanned = set.status == .planned
        let restSeconds = item.exercise.restSeconds ?? RestTimer.defaultSeconds
        let activity = isPlanned ? state.restActivity(afterLogging: id) : nil
        return Task {
            defer { inFlight.remove(id) }
            do {
                if isPlanned {
                    _ = try await sets.log(setID: id)
                    startRest(seconds: restSeconds, activity: activity)
                } else {
                    _ = try await sets.unlog(setID: id)
                }
            } catch {
                showToast(.failed)
            }
        }
    }

    private func skip(_ id: UUID) -> Task<Void, Never>? {
        guard detail?.find(setID: id) != nil, !inFlight.contains(id) else { return nil }
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
        guard detail?.find(setID: id) != nil else { return nil }
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

    private func openEditor(_ id: UUID) {
        guard case (let item, let set)? = detail?.find(setID: id) else { return }
        state.editor = SetEditor(set: set, in: item, previous: state.previous, days: days)
    }

    /// Done: saves values through `saveValues` only and never logs the set (product rule). "Apply to later sets" also
    /// saves a new weight onto the later planned sets of the same kind, each keeping its own reps.
    private func saveEditor() -> Task<Void, Never>? {
        guard let editor = state.editor else { return nil }
        state.editor = nil
        let weight = editor.weight > 0 ? Weight(editor.weight, editor.unit) : nil
        let reps = editor.reps > 0 ? editor.reps : nil
        let updates = detail?.find(setID: editor.id).map { editor.laterSets(in: $0.0, weight: weight) } ?? []
        return write { sets in
            _ = try await sets.saveValues(setID: editor.id, reps: reps, weight: weight)
            for set in updates {
                _ = try await sets.saveValues(setID: set.id, reps: set.actualReps, weight: weight)
            }
        }
    }

    // MARK: Rest

    /// Starts the countdown in the app and on the Lock Screen and Dynamic Island; leaving the workout ends both.
    private func startRest(seconds: Int, activity: RestActivityStart?) {
        guard seconds > 0 else {
            endRest()
            return
        }
        state.rest = RestTimer(run: (state.rest?.run ?? 0) + 1, seconds: seconds)
        restActivity.start(seconds: seconds, activity: activity)
    }

    private func extendRest() {
        guard let rest = state.rest?.extended(by: RestTimer.extensionSeconds) else { return }
        state.rest = rest
        restActivity.extend(by: RestTimer.extensionSeconds, totalSeconds: rest.total)
    }

    /// Skip or zero: the countdown goes away in the app and on the Live Activity.
    private func endRest() {
        state.rest = nil
        restActivity.end()
    }

    private func loadThumbnail(_ catalogID: String) -> Task<Void, Never>? {
        guard state.thumbnails[catalogID] == nil else { return nil }
        state.thumbnails[catalogID] = .loading
        let catalog = catalog
        return Task { state.thumbnails[catalogID] = await catalog.image(.still, catalogID: catalogID) }
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
