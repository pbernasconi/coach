import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class WeekViewModel {
    private(set) var state = WeekState()

    private let sessions: any SessionRepository
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    @ObservationIgnored private var today: LocalDay?
    @ObservationIgnored private var selected: LocalDay?
    /// Every session in the strip's range; `.loading` until the first value arrives.
    @ObservationIgnored private var summaries: Loadable<[SessionSummary]> = .loading

    /// Protocols only, no defaults, no work (SCR-3).
    init(sessions: any SessionRepository, now: @escaping @Sendable () -> Date, calendar: Calendar) {
        self.sessions = sessions
        self.now = now
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes every session in the strip's range; started by the Screen's `.task` (SCR-4).
    func run() async {
        let today = days.day(of: now())
        self.today = today
        if selected == nil { selected = today }
        render()
        let thisWeek = days.weekStart(of: today)
        let first = thisWeek.adding(days: 7 * WeekState.weeks.lowerBound)
        let last = thisWeek.adding(days: 7 * (WeekState.weeks.upperBound + 1) - 1)
        for await details in sessions.observeSessions(from: first, through: last) {
            summaries = .loaded(details.map { SessionSummary(detail: $0) })
            render()
        }
    }

    @discardableResult
    func send(_ action: WeekAction) -> Task<Void, Never>? {
        switch action {
        case .daySelected(let date):
            selected = days.day(of: date)
            render()
        case .weekChanged(let offset):
            state.weekOffset = offset
        case .sessionTapped:
            break  // Opens the workout screen once it exists.
        }
        return nil
    }

    private func render() {
        guard let today, let selected, let todayDate = days.date(of: today),
            let selectedDate = days.date(of: selected)
        else { return }
        let title = selected == today ? String(localized: "Today") : days.longTitle(of: selected)
        guard case .loaded(let all) = summaries else {
            state.strip = WeekStrip(today: todayDate, selected: selectedDate, title: title, days: [])
            return
        }
        state.strip = WeekStrip(today: todayDate, selected: selectedDate, title: title, days: markedDays(all))
        let onDay = all.filter { $0.day == selected }
        state.sessions = onDay.isEmpty ? .empty : .loaded(onDay)
    }

    private func markedDays(_ summaries: [SessionSummary]) -> [WeekDay] {
        Dictionary(grouping: summaries, by: \.day)
            .sorted { $0.key < $1.key }
            .compactMap { day, onDay in
                guard let date = days.date(of: day) else { return nil }
                return WeekDay(date: date, status: onDay.allSatisfy(\.isDone) ? .done : .planned)
            }
    }
}
