import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class WorkoutViewModel {
    private(set) var state = WorkoutState()

    private let sessionID: UUID
    private let sessions: any SessionRepository
    let sets: any SetRepository
    private let router: any Navigating
    private let clock: any Clock<Duration>
    /// The rest's wall-clock end and its Live Activity.
    private let restActivity: RestActivitySession
    /// The catalog, for exercise thumbnails.
    private let catalog: any ExerciseCatalogProviding
    /// Each library exercise's sets last time, read once when the session first loads.
    private let previousSets: PreviousSetsLoader
    /// The gym's bars and plates, for plates per side, warm-ups and the weight step; read each time the session shows.
    private let gym: any GymPreference
    private let days: DayCalendar
    private let now: @Sendable () -> Date  // when a rest ran out
    /// The latest session from the store; the source for the editor, Add set and rest times.
    @ObservationIgnored private(set) var detail: SessionDetail?
    /// Add, move and remove exercises, finish, discard and Save as template (`WorkoutViewModel+Session`).
    let edits: WorkoutSessionEdits
    @ObservationIgnored var isEditingSession = false
    /// Set by Discard: the page keeps showing the session while it closes, instead of "Workout not found".
    @ObservationIgnored var hasDiscarded = false
    /// Sets with a log, unlog or skip on the way, so a double tap writes once.
    @ObservationIgnored private var inFlight: Set<UUID> = []
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessionID: UUID,
        sessions: any SessionRepository,
        sets: any SetRepository,
        templates: any TemplateRepository,
        router: any Navigating,
        clock: any Clock<Duration>,
        restActivity: any RestActivityController,
        catalog: any ExerciseCatalogProviding,
        history: any ExerciseHistoryRepository,
        health: any WorkoutHealthRecording,
        gym: any GymPreference,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.sessionID = sessionID
        self.sessions = sessions
        self.sets = sets
        self.router = router
        self.edits = WorkoutSessionEdits(
            sessionID: sessionID,
            sessions: sessions,
            templates: templates,
            router: router,
            health: health
        )
        self.clock = clock
        self.restActivity = RestActivitySession(controller: restActivity, now: now)
        self.catalog = catalog
        self.previousSets = PreviousSetsLoader(history: history)
        self.gym = gym
        self.days = DayCalendar(calendar: calendar)
        self.now = now
    }

    /// Observes the session (started by the Screen's `.task`, SCR-4); the first time, also each exercise's last sets.
    func run() async {
        var hasReadPrevious = false
        for await detail in sessions.observeSession(id: sessionID) {
            self.detail = detail
            guard let detail else {
                if !hasDiscarded {
                    state.workout = .empty
                    state.editor = nil
                }
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
        state.workout = .loaded(WorkoutOverview(detail: detail, days: days, previous: state.previous, gym: gym.setup))
        state.adoptRest(restActivity.follow(workout: detail.id, restingAfter: state.rest?.setID), at: now())
    }

    /// Counts the rest down once a second on the injected clock. The Screen restarts it for each new rest
    /// (`.task(id: state.rest?.run)`), and cancelling it stops the countdown. Each tick also follows the Live Activity
    /// (the wall clock, and its +30s and Skip while the app was in the background). Reaching zero ends the rest.
    func runRestTimer() async {
        while let rest = state.rest {
            do {
                try await clock.sleep(for: .seconds(1))
            } catch {
                return
            }
            guard let current = state.rest, current.run == rest.run else { return }
            state.rest = restActivity.tick(current)
            if state.rest == nil { finishRest(after: current.setID) }
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

    /// The editor, the rest timer, "How to" and the options sheets; session writes go to `sendSession`.
    private func sendLocal(_ action: WorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .setValuesTapped(let id): openEditor(id)
        case .editorWeightChanged, .editorRepsChanged, .editorApplyToLaterChanged, .editorRPEChanged,
            .editorNoteChanged, .editorDismissed:
            state.editor = state.editor?.applying(action)
        case .editorDoneTapped: return saveEditor()
        case .sessionNoteTapped, .exerciseNoteTapped: openNote(action)
        case .noteTextChanged, .noteDismissed: state.noteEditor = state.noteEditor?.applying(action)
        case .noteDoneTapped:
            defer { state.noteEditor = nil }
            return state.noteEditor.flatMap(saveNote)
        case .restExtendTapped: extendRest()
        case .restSkipTapped: finishRest(after: state.rest?.setID)
        case .restReadyDismissed: state.ready = nil
        case .howToTapped(let exerciseID): router.open(.exercise(exerciseID))
        case .thumbnailNeeded(let catalogID): return loadThumbnail(catalogID)
        case .workoutOptionsTapped, .exerciseOptionsTapped, .optionsDismissed: state.options = options(for: action)
        default: return sendSession(action)
        }
        return nil
    }

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
                    startRest(seconds: restSeconds, activity: activity, setID: id)
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

    private func openEditor(_ id: UUID) {
        guard case (let item, let set)? = detail?.find(setID: id) else { return }
        state.noteEditor = nil
        state.editor = SetEditor(set: set, in: item, previous: state.previous, days: days, gym: gym.setup)
    }

    /// Done: closes the editor and saves it (`saveSetEditor`); it never logs the set (product rule).
    private func saveEditor() -> Task<Void, Never>? {
        guard let editor = state.editor else { return nil }
        state.editor = nil
        return saveSetEditor(editor)
    }

    /// The session's or one exercise's note editor; any other sheet closes first.
    private func openNote(_ action: WorkoutAction) {
        guard let detail, let editor = NoteEditor(opening: action, in: detail) else { return }
        state.editor = nil
        state.options = nil
        state.noteEditor = editor
    }

    private func loadThumbnail(_ catalogID: String) -> Task<Void, Never>? {
        guard state.thumbnails[catalogID] == nil else { return nil }
        state.thumbnails[catalogID] = .loading
        let catalog = catalog
        return Task { state.thumbnails[catalogID] = await catalog.image(.still, catalogID: catalogID) }
    }

    func showToast(_ kind: WorkoutToast.Kind) {
        serial += 1
        state.toast = WorkoutToast(serial: serial, kind: kind)
    }
}

extension WorkoutViewModel {
    /// A new rest from full for the set just ticked, even while another is running; also on the Lock Screen.
    private func startRest(seconds: Int, activity: RestActivityStart?, setID: UUID) {
        state.beginRest(seconds: seconds, setID: setID)
        if state.rest == nil { restActivity.end() } else { restActivity.start(seconds: seconds, activity: activity) }
    }

    /// +30s, on top of any time added on the Lock Screen meanwhile.
    private func extendRest() {
        guard let rest = state.rest, let next = restActivity.extend(by: RestTimer.extensionSeconds) else { return }
        state.rest = rest.extended(by: next.totalSeconds - rest.total)
    }

    /// Zero, or Skip here or on the Lock Screen: the countdown ends everywhere and the bar turns to the next set.
    private func finishRest(after setID: UUID?) {
        state.readyNext(after: setID, at: now())
        restActivity.end()
    }
}
