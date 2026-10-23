import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class WorkoutSummaryViewModel {
    private(set) var state = WorkoutSummaryState()

    private let sessionID: UUID
    private let sessions: any SessionRepository
    private let history: any ExerciseHistoryRepository
    private let router: any Navigating
    /// Saving finished workouts to Apple Health; the first summary asks.
    private let health: any WorkoutHealthRecording
    private let days: DayCalendar
    /// Where Apple Health stood when the summary opened, updated by the prompt's answers.
    @ObservationIgnored private var healthStatus = HealthStatus.notSaved
    /// Each library exercise's sets logged before this workout, read once.
    @ObservationIgnored private var earlier: [UUID: [LoggedSet]] = [:]
    @ObservationIgnored private var hasReadEarlier = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessionID: UUID,
        sessions: any SessionRepository,
        history: any ExerciseHistoryRepository,
        health: any WorkoutHealthRecording,
        router: any Navigating,
        calendar: Calendar
    ) {
        self.sessionID = sessionID
        self.sessions = sessions
        self.history = history
        self.health = health
        self.router = router
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes the session; started by the Screen's `.task` (SCR-4). The earlier history is read once, the first time
    /// the session loads.
    func run() async {
        healthStatus = health.status()
        for await detail in sessions.observeSession(id: sessionID) {
            guard let detail else {
                state.summary = .empty
                state.health = nil
                continue
            }
            state.health = healthRow(detail.session)
            let earlier = await earlierSets(before: detail)
            let unit = detail.session.unitsAtLog
            let summary = WorkoutSummarizer.summarize(detail.domain, earlier: earlier, unit: unit)
            state.summary = .loaded(
                WorkoutSummaryOverview(
                    title: detail.session.title,
                    dayTitle: days.longTitle(of: detail.session.day),
                    duration: summary.duration.map(WorkoutSummaryText.duration),
                    sets: "\(summary.setsLogged)",
                    bests: summary.bests.map { WorkoutSummaryText.best($0, unit: unit) }
                )
            )
        }
    }

    @discardableResult
    func send(_ action: WorkoutSummaryAction) -> Task<Void, Never>? {
        switch action {
        case .doneTapped:
            router.backToRoot()  // the workout is over: home, not back to its sets
        case .healthAllowTapped:
            guard state.health == .ask else { return nil }
            state.health = nil  // "Saved to Apple Health" shows once the workout is saved
            let id = sessionID
            return Task { healthStatus = await health.allow(savingSession: id) }
        case .healthNotNowTapped:
            guard state.health == .ask else { return nil }
            state.health = nil
            healthStatus = .off
            return Task { _ = await health.setEnabled(false) }
        }
        return nil
    }

    /// "Saved to Apple Health" once the workout is there; the prompt on a finished workout while Health was never
    /// asked (the first finish); nothing otherwise.
    private func healthRow(_ session: SessionRecord) -> SummaryHealth? {
        if session.healthWorkoutID != nil { return .saved }
        return session.finishedAt != nil && healthStatus == .notAsked ? .ask : nil
    }

    /// The sets of each library exercise in `detail` logged in sessions before it (an earlier day, or earlier the same
    /// day), read once.
    private func earlierSets(before detail: SessionDetail) async -> [UUID: [LoggedSet]] {
        if hasReadEarlier { return earlier }
        let session = detail.session
        var result: [UUID: [LoggedSet]] = [:]
        for exerciseID in Set(detail.items.compactMap(\.exercise.exerciseID)) {
            for await entries in history.observeHistory(exerciseID: exerciseID, limit: 500) {
                result[exerciseID] = entries.filter { entry in
                    entry.session.id != session.id
                        && (entry.session.day < session.day
                            || (entry.session.day == session.day && entry.session.createdAt < session.createdAt))
                }
                .flatMap { $0.sets.map(\.loggedSet) }
                break
            }
        }
        earlier = result
        hasReadEarlier = true
        return result
    }
}
