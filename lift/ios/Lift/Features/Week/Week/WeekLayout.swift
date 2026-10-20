import Foundation
import LiftCore

/// The pure part of the Week screen: which days the strip and the list show, given today, the visible page and the
/// selected day. Kept apart from the ViewModel so the rules read in one place.
nonisolated struct WeekLayout: Sendable {
    let days: DayCalendar
    let today: LocalDay

    /// The first day of the week `offset` weeks from this one.
    func weekStart(offset: Int) -> LocalDay {
        days.weekStart(of: today).adding(days: 7 * offset)
    }

    /// Every day the strip can page to, first through last.
    var stripRange: ClosedRange<LocalDay> {
        let first = weekStart(offset: WeekState.weeks.lowerBound)
        let last = weekStart(offset: WeekState.weeks.upperBound).adding(days: 6)
        return first...last
    }

    /// The seven days of the week `offset` weeks from this one.
    func week(offset: Int) -> ClosedRange<LocalDay> {
        let start = weekStart(offset: offset)
        return start...start.adding(days: 6)
    }

    /// The week offset that contains `day`.
    func offset(of day: LocalDay) -> Int {
        WeekState.weeks.first { week(offset: $0).contains(day) } ?? 0
    }

    /// The day to select on the page `offset`: today on this week's page, otherwise the page's first day.
    func defaultSelection(offset: Int) -> LocalDay {
        week(offset: offset).contains(today) ? today : weekStart(offset: offset)
    }

    /// The list for the week `offset`: all seven days, each with its sessions. A day without any is a rest day.
    func sections(_ summaries: [SessionSummary], offset: Int, selected: LocalDay) -> [WeekDaySection] {
        let week = week(offset: offset)
        let byDay = Dictionary(grouping: summaries.filter { week.contains($0.day) }, by: \.day)
        return (0..<7).map { index in
            let day = week.lowerBound.adding(days: index)
            return WeekDaySection(
                id: day,
                title: title(of: day),
                weekday: days.weekdayTitle(of: day),
                dayNumber: days.dayNumber(of: day),
                isToday: day == today,
                isSelected: day == selected,
                sessions: byDay[day] ?? []
            )
        }
    }

    /// Days with sessions, marked done when every session that day is done.
    func markedDays(_ summaries: [SessionSummary]) -> [WeekDay] {
        Dictionary(grouping: summaries, by: \.day)
            .sorted { $0.key < $1.key }
            .compactMap { day, onDay in
                guard let date = days.date(of: day) else { return nil }
                return WeekDay(date: date, status: onDay.allSatisfy(\.isDone) ? .done : .planned)
            }
    }

    /// "Monday, 2 March", or "Today · Monday, 2 March".
    func title(of day: LocalDay) -> String {
        let long = days.longTitle(of: day)
        return day == today ? String(localized: "Today · \(long)") : long
    }
}
