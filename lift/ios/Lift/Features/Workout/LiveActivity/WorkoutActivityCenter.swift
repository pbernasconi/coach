import Foundation
import LiftCore
import LiftStore

/// The workout on the Lock Screen and in the Dynamic Island, for the whole workout: from the first logged set until it
/// is finished or discarded, also after the Workout screen is left. It follows the session in the store, so a tick in
/// the app moves it on, and its own buttons (`WorkoutActivityIntents.swift`) log sets through the same repository as
/// the app (PLAT-2). The composition root makes one; the Workout screen reaches it as its `RestActivityController`, and
/// the buttons through `WorkoutActivityButtons`. With the Live Activity turned off in Workout settings it still follows
/// the rest, for the rest-over alert, but shows nothing.
final class WorkoutActivityCenter: RestActivityController {
    private let sessions: any SessionRepository
    private let sets: any SetRepository
    private let presenter: any WorkoutActivityPresenting
    private let gym: any GymPreference
    private let stills: WorkoutActivityStillCache
    /// Workout settings: the default rest, whether a rest starts, and whether the Live Activity shows.
    private let preferences: any WorkoutPreferenceStore
    private let restAlerts: any RestAlerting
    /// The workout timeline; the buttons record their own moments (`.lockScreen`).
    private let events: any WorkoutEventRepository
    private let days: DayCalendar
    private let now: @Sendable () -> Date

    /// The workout followed; nil before any.
    private(set) var sessionID: UUID?
    /// The followed workout as the store last had it; nil until it loads.
    private var detail: SessionDetail?
    /// The rest after the last logged set, as the app and the buttons left it.
    private var rest: RestSnapshot?
    /// The set Next moved to; nil follows the last logged set.
    private var focus: UUID?
    /// The store has answered for the followed workout at least once, so a nil there means it is gone.
    private var isLoaded = false
    private var isShown = false
    private var observation: Task<Void, Never>?
    /// The latest change on its way to the screen. Each waits for the one before, so they land in order.
    private var publishing: Task<Void, Never>?

    init(
        sessions: any SessionRepository,
        sets: any SetRepository,
        presenter: any WorkoutActivityPresenting,
        gym: any GymPreference,
        stills: any WorkoutActivityStills = NoWorkoutActivityStills(),
        preferences: any WorkoutPreferenceStore = InMemoryWorkoutSettings(),
        events: any WorkoutEventRepository = NoWorkoutEvents(),
        restAlerts: any RestAlerting = NoRestAlerts(),
        calendar: Calendar,
        now: @escaping @Sendable () -> Date
    ) {
        self.sessions = sessions
        self.sets = sets
        self.presenter = presenter
        self.gym = gym
        self.stills = WorkoutActivityStillCache(stills: stills)
        self.preferences = preferences
        self.restAlerts = restAlerts
        self.events = events
        self.days = DayCalendar(calendar: calendar)
        self.now = now
    }

    // MARK: The Workout screen

    func showWorkout(_ sessionID: UUID) {
        follow(sessionID)
    }

    func resume() {
        guard sessionID == nil, let running = presenter.running() else { return }
        follow(running.attributes.sessionID)
        rest = running.state.rest
        isShown = true
    }

    func start(_: RestActivityAttributes, state: RestActivityAttributes.ContentState) {
        rest = RestSnapshot(endsAt: state.endsAt, totalSeconds: state.totalSeconds)
        focus = nil
        publish()
    }

    func update(endsAt: Date, totalSeconds: Int) {
        rest = RestSnapshot(endsAt: endsAt, totalSeconds: totalSeconds)
        publish()
    }

    func end() {
        guard rest != nil else { return }
        rest = nil
        publish()
    }

    func currentRest() -> RestSnapshot? {
        rest
    }

    /// Stops following the workout and removes its Live Activity, before Lift opens other data (practice mode).
    func stop() async {
        observation?.cancel()
        sessionID = nil
        detail = nil
        isLoaded = false
        rest = nil
        focus = nil
        isShown = false
        restAlerts.restChanged(endsAt: nil, nextSet: nil)
        await publishing?.value
        await presenter.end()
    }

    // MARK: The Live Activity's buttons

    /// Done: logs the set the Live Activity shows (`logSet(_:in:)`).
    func logShownSet() async {
        resume()
        guard let shown = presenter.running(), let set = shown.state.current else { return }
        await logSet(set.id, in: shown.attributes.sessionID)
    }

    /// Next: offers the planned set after the one the Live Activity shows (`showNextSet(after:in:)`).
    func showNextSet() async {
        resume()
        guard let shown = presenter.running(), let set = shown.state.current else { return }
        await showNextSet(after: set.id, in: shown.attributes.sessionID)
    }

    /// Done: logs `setID` and starts its exercise's rest from full (or the default rest), as a tick in the app does; a
    /// paused workout resumes first. A set that is no longer planned (logged in the app meanwhile, or a second tap) is
    /// left alone.
    func logSet(_ setID: UUID, in sessionID: UUID) async {
        await load(sessionID)
        guard case (let item, let set)? = detail?.find(setID: setID), set.status == .planned else { return }
        let settings = preferences.preferences
        let seconds = settings.startsRest ? item.exercise.restSeconds ?? settings.defaultRestSeconds : 0
        let endsAt = now().addingTimeInterval(TimeInterval(seconds))
        let before = rest
        // The rest is set before the write: the open Workout screen asks for it as soon as it sees the logged set.
        rest = seconds > 0 ? RestSnapshot(endsAt: endsAt, totalSeconds: seconds, setID: setID) : nil
        let at = now()
        do {
            if detail?.session.pausedAt != nil {
                _ = try await sessions.changeTime(sessionID: sessionID, .resume)
                record(.workoutResumed, in: sessionID, at: at)
            }
            _ = try await sets.log(setID: setID)
            record(.setLogged, in: sessionID, setID: setID, at: at)
            if seconds > 0 { record(.restStarted, in: sessionID, setID: setID, seconds: seconds, at: at) }
        } catch {
            rest = before
            AppLog.rest.error(
                "Logging a set from the Lock Screen failed: \(String(describing: error), privacy: .private)"
            )
            return
        }
        focus = nil
        received(await latest(sessionID))
        await publishNow()
    }

    /// Next: offers the planned set after `setID` without logging anything.
    func showNextSet(after setID: UUID, in sessionID: UUID) async {
        await load(sessionID)
        guard let next = detail?.plannedSet(after: setID) else { return }
        focus = next
        await publishNow()
    }

    /// +30s on the rest, while there is one left.
    func extendRest() async {
        let at = now()
        await showAtOnce { state in
            if let longer = state.rest?.extended(by: RestSnapshot.extensionSeconds, at: at) { state.rest = longer }
        }
        await loadRunning()
        guard let next = rest?.extended(by: RestSnapshot.extensionSeconds, at: now()) else { return }
        if let sessionID {
            record(.restExtended, in: sessionID, setID: next.setID, seconds: RestSnapshot.extensionSeconds, at: at)
        }
        rest = next
        await publishNow()
    }

    /// Skip: the rest is over now; the workout stays.
    func skipRest() async {
        let at = now()
        await showAtOnce { $0.rest = nil }
        await loadRunning()
        if let sessionID, let skipped = rest, skipped.endsAt > at {
            let rested = max(0, skipped.totalSeconds - skipped.secondsLeft(at: at))
            record(.restSkipped, in: sessionID, setID: skipped.setID, seconds: rested, at: at)
        }
        rest = nil
        await publishNow()
    }

    /// Stores one moment the Live Activity's buttons made, on the workout timeline. A failed write is only logged.
    private func record(
        _ kind: WorkoutEventKind,
        in sessionID: UUID,
        setID: UUID? = nil,
        seconds: Int? = nil,
        at: Date
    ) {
        let event = WorkoutEvent(
            sessionID: sessionID,
            kind: kind,
            occurredAt: at,
            setID: setID,
            seconds: seconds,
            source: .lockScreen
        )
        let events = events
        Task {
            do {
                try await events.record(event)
            } catch {
                AppLog.workout.error(
                    "Recording \(kind.rawValue) failed: \(String(describing: error), privacy: .private)"
                )
            }
        }
    }

    /// Changes what the Live Activity shows now at once, before the workout is read from the store, so the tap shows
    /// on the Lock Screen straight away. A button that launched Lift, or found it suspended, would otherwise wait for
    /// the app to start and the workout to load first, which felt broken (Paolo, 2026-10-27). The full publish that
    /// follows draws the same thing from the store.
    private func showAtOnce(_ change: (inout WorkoutActivityAttributes.ContentState) -> Void) async {
        guard let running = presenter.running() else { return }
        var state = running.state
        change(&state)
        guard state != running.state else { return }
        await presenter.show(running.attributes, state: state)
    }

    // MARK: Following the workout

    private func follow(_ id: UUID) {
        guard id != sessionID else { return }
        observation?.cancel()
        sessionID = id
        detail = nil
        isLoaded = false
        rest = nil
        focus = nil
        observation = Task {
            for await detail in sessions.observeSession(id: id) {
                guard !Task.isCancelled else { return }
                received(detail)
                publish()
            }
        }
    }

    /// Follows `id` and waits for it to load, for a button that may have launched Lift.
    private func load(_ id: UUID) async {
        if sessionID == nil { resume() }
        follow(id)
        if !isLoaded { received(await latest(id)) }
    }

    /// Follows the workout on the Lock Screen and waits for it to load, for +30s and Skip.
    private func loadRunning() async {
        resume()
        if let sessionID, !isLoaded { received(await latest(sessionID)) }
    }

    private func received(_ detail: SessionDetail?) {
        self.detail = detail
        isLoaded = true
    }

    private func latest(_ id: UUID) async -> SessionDetail? {
        for await detail in sessions.observeSession(id: id) {
            return detail
        }
        return nil
    }

    // MARK: Showing it

    private enum Change {
        case show(WorkoutActivityAttributes, WorkoutActivityAttributes.ContentState)
        case end
    }

    /// What the Lock Screen shows now: nothing while loading, the workout while under way, else no activity.
    private func change(_ content: (WorkoutActivityAttributes, WorkoutActivityAttributes.ContentState)?) -> Change? {
        guard sessionID != nil, isLoaded else { return nil }
        guard let content, preferences.preferences.showsLiveActivity else { return isShown ? .end : nil }
        return .show(content.0, content.1)
    }

    /// The workout as the Lock Screen would draw it; nil while loading or once it is not under way.
    private func content() -> (WorkoutActivityAttributes, WorkoutActivityAttributes.ContentState)? {
        guard sessionID != nil, isLoaded, let detail, detail.isUnderway else { return nil }
        let overview = WorkoutOverview(detail: detail, days: days, previous: [:], gym: gym.setup)
        let setID = detail.activitySetID(focus: focus)
        var state = WorkoutActivityAttributes.ContentState(overview: overview, currentSetID: setID, rest: rest)
        let still = stills.still(forSet: setID, in: overview) { [weak self] in self?.publish() }
        state.current?.still = still
        return (WorkoutActivityAttributes(sessionID: detail.id, title: detail.session.title), state)
    }

    private func publish() {
        let shown = content()
        // A finished or discarded workout has no rest left to alert for.
        let endsAt = isLoaded && shown == nil ? nil : rest?.endsAt
        restAlerts.restChanged(endsAt: endsAt, nextSet: shown?.1.current.map { "\($0.exerciseName) · \($0.title)" })
        guard let change = change(shown) else { return }
        switch change {
        case .show: isShown = true
        case .end: isShown = false
        }
        let previous = publishing
        publishing = Task {
            await previous?.value
            switch change {
            case .show(let attributes, let state): await presenter.show(attributes, state: state)
            case .end: await presenter.end()
            }
        }
    }

    /// Waits until the store has stopped answering and every change has reached the screen (tests).
    func settle() async {
        await observation?.value
        await publishing?.value
    }

    private func publishNow() async {
        publish()
        await publishing?.value
    }
}
