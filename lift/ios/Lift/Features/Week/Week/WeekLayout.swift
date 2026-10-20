import Foundation
import LiftCore
import LiftSync

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

    /// The list for the week `offset`: all seven days, each with its rows. A day without any is a free day.
    func sections(_ merge: WeekPlanMerge, offset: Int, selected: LocalDay) -> [WeekDaySection] {
        let week = week(offset: offset)
        return (0..<7).map { index in
            let day = week.lowerBound.adding(days: index)
            return WeekDaySection(
                id: day,
                title: title(of: day),
                weekday: days.weekdayTitle(of: day),
                dayNumber: days.dayNumber(of: day),
                isToday: day == today,
                isSelected: day == selected,
                entries: merge.entries(on: day)
            )
        }
    }

    /// Days with rows, marked done when every row that day is done.
    func markedDays(_ merge: WeekPlanMerge) -> [WeekDay] {
        merge.markedDays.compactMap { marked in
            days.date(of: marked.day).map { WeekDay(date: $0, status: marked.isDone ? .done : .planned) }
        }
    }

    /// The plan line for the week `offset`, or nil when sync is off or the week is not kept.
    func planHeader(_ snapshot: CoachPlanSnapshot, offset: Int) -> WeekPlanHeader? {
        let start = weekStart(offset: offset)
        guard let book = snapshot.shownBook, let week = book.weeks[start] else { return nil }
        let isOffline = snapshot.status == .offline
        let updated = book.updatedAt(of: start).map { date in
            let time = days.day(of: date) == today ? days.timeTitle(of: date) : days.shortTitle(of: days.day(of: date))
            return isOffline ? String(localized: "Offline · updated \(time)") : String(localized: "Updated \(time)")
        }
        return WeekPlanHeader(
            title: week.title.flatMap { $0.isEmpty ? nil : $0 },
            totals: week.totals.text,
            freshness: updated ?? (isOffline ? String(localized: "Offline") : nil),
            isOffline: isOffline
        )
    }

    /// "Monday, 2 March", or "Today · Monday, 2 March".
    func title(of day: LocalDay) -> String {
        let long = days.longTitle(of: day)
        return day == today ? String(localized: "Today · \(long)") : long
    }

    /// The lift sheet's subject; nil for a done session, which cannot be rescheduled.
    func sessionRef(_ summary: SessionSummary, templates: [WeekTemplateChoice]) -> WeekSessionRef? {
        guard !summary.isDone else { return nil }
        return WeekSessionRef(
            id: summary.id,
            title: summary.title,
            dayTitle: days.longTitle(of: summary.day),
            templateID: summary.templateID,
            canChangeWorkout: templates.contains { $0.id != summary.templateID }
        )
    }

    /// The day picker for a planned session, limited to the days the strip shows.
    func move(_ summary: SessionSummary, templates: [WeekTemplateChoice]) -> WeekMove? {
        guard let ref = sessionRef(summary, templates: templates), let current = days.date(of: summary.day),
            let first = days.date(of: stripRange.lowerBound), let last = days.date(of: stripRange.upperBound)
        else { return nil }
        return WeekMove(
            id: ref.id,
            title: ref.title,
            dayTitle: ref.dayTitle,
            current: current,
            first: first,
            last: last
        )
    }
}
