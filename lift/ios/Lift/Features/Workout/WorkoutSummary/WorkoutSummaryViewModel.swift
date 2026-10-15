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
    private let days: DayCalendar
    /// Each library exercise's sets logged before this workout, read once.
    @ObservationIgnored private var earlier: [UUID: [LoggedSet]] = [:]
    @ObservationIgnored private var hasReadEarlier = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessionID: UUID,
        sessions: any SessionRepository,
        history: any ExerciseHistoryRepository,
        router: any Navigating,
        calendar: Calendar
    ) {
        self.sessionID = sessionID
        self.sessions = sessions
        self.history = history
        self.router = router
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes the session; started by the Screen's `.task` (SCR-4). The earlier history is read once, the first time
    /// the session loads.
    func run() async {
        for await detail in sessions.observeSession(id: sessionID) {
            guard let detail else {
                state.summary = .empty
                continue
            }
            let earlier = await earlierSets(before: detail)
            let unit = detail.session.unitsAtLog
            let summary = WorkoutSummarizer.summarize(detail.domain, earlier: earlier, unit: unit)
            state.summary = .loaded(
                WorkoutSummaryOverview(
                    title: detail.session.title,
                    dayTitle: days.longTitle(of: detail.session.day),
                    duration: summary.duration.map(WorkoutSummaryText.duration),
                    sets: "\(summary.setsLogged)",
                    volume: WorkoutSummaryText.volume(summary.volume),
                    unit: unit.rawValue,
                    bests: summary.bests.map { WorkoutSummaryText.best($0, unit: unit) }
                )
            )
        }
    }

    @discardableResult
    func send(_ action: WorkoutSummaryAction) -> Task<Void, Never>? {
        switch action {
        case .doneTapped:
            router.back()
        }
        return nil
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
