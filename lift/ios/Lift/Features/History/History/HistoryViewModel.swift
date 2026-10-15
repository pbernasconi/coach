import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class HistoryViewModel {
    private(set) var state = HistoryState()

    private let sessions: any SessionRepository
    private let router: any Navigating
    private let importFlow: any ImportFlowPresenting
    private let now: @Sendable () -> Date
    private let days: DayCalendar

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessions: any SessionRepository,
        router: any Navigating,
        importFlow: any ImportFlowPresenting,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.sessions = sessions
        self.router = router
        self.importFlow = importFlow
        self.now = now
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes the last `HistoryState.weekCount` weeks through today; started by the Screen's `.task` (SCR-4).
    /// A session counts as past once its day has gone by, or as soon as a set in it is logged.
    func run() async {
        let today = days.day(of: now())
        let first = days.weekStart(of: today).adding(days: -7 * (HistoryState.weekCount - 1))
        for await details in sessions.observeSessions(from: first, through: today) {
            let past = details.map { SessionSummary(detail: $0) }
                .filter { $0.day < today || $0.hasLoggedSets }
            let weeks = group(past)
            state.weeks = weeks.isEmpty ? .empty : .loaded(weeks)
        }
    }

    @discardableResult
    func send(_ action: HistoryAction) -> Task<Void, Never>? {
        switch action {
        case .sessionTapped(let id):
            router.open(.workout(id))
        case .importTapped:
            importFlow.presentImport()
        }
        return nil
    }

    /// Groups sessions (oldest first, as the repository returns them) into weeks, newest week and session first.
    private func group(_ past: [SessionSummary]) -> [HistoryWeek] {
        var weeks: [HistoryWeek] = []
        for summary in past.reversed() {
            let start = days.weekStart(of: summary.day)
            let session = HistorySession(summary: summary, dayTitle: days.shortTitle(of: summary.day))
            if weeks.last?.id == start {
                weeks[weeks.count - 1].sessions.append(session)
            } else {
                weeks.append(HistoryWeek(id: start, title: days.weekTitle(start: start), sessions: [session]))
            }
        }
        return weeks
    }
}
