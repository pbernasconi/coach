import Foundation

/// Month-grid maths for `KoboCalendar`. Every day is midnight in `calendar`; the calendar decides the first weekday
/// (Sunday in the US, Monday in most of Europe). The grid always has six weeks, so the calendar never changes height
/// between months.
nonisolated struct MonthGrid: Sendable {
    let calendar: Calendar

    /// Weeks in every grid.
    static let weekCount = 6
    /// Without a `maxDate`, the calendar pages this many months past today.
    static let defaultMonthsAhead = 12

    /// Midnight on the first day of the month containing `date`.
    func startOfMonth(_ date: Date) -> Date {
        calendar.dateInterval(of: .month, for: date)?.start ?? calendar.startOfDay(for: date)
    }

    /// The first day of the month `offset` months from the month containing `date`.
    func month(_ date: Date, adding offset: Int) -> Date {
        let start = startOfMonth(date)
        return calendar.date(byAdding: .month, value: offset, to: start).map(startOfMonth) ?? start
    }

    /// Six weeks of days around the month containing `anchor`, each week starting on the calendar's first weekday.
    func weeks(of anchor: Date) -> [[Date]] {
        let first = startOfMonth(anchor)
        let days = calendar.weekdaySymbols.count
        let weekday = calendar.component(.weekday, from: first)
        let leading = (weekday - calendar.firstWeekday + days) % days
        guard let gridStart = calendar.date(byAdding: .day, value: -leading, to: first) else { return [] }
        return (0..<Self.weekCount).map { week in
            (0..<days).compactMap { calendar.date(byAdding: .day, value: week * days + $0, to: gridStart) }
        }
    }

    /// True when `day` falls in the month containing `month`.
    func isInMonth(_ day: Date, month: Date) -> Bool {
        calendar.isDate(day, equalTo: month, toGranularity: .month)
    }

    /// The last day the calendar pages to: `maxDate`, or the same day `defaultMonthsAhead` months after `today`.
    func upperBound(maxDate: Date?, today: Date) -> Date {
        if let maxDate { return calendar.startOfDay(for: maxDate) }
        let ahead = calendar.date(byAdding: .month, value: Self.defaultMonthsAhead, to: today) ?? today
        return calendar.startOfDay(for: ahead)
    }

    /// Whether the month before `anchor`'s still has a day on or after `minDate`.
    func canGoToPreviousMonth(_ anchor: Date, minDate: Date?) -> Bool {
        minDate.map { startOfMonth(anchor) > startOfMonth($0) } ?? true
    }

    /// Whether the month after `anchor`'s still has a day on or before `maxDate`.
    func canGoToNextMonth(_ anchor: Date, maxDate: Date?) -> Bool {
        maxDate.map { startOfMonth(anchor) < startOfMonth($0) } ?? true
    }

    /// The first day of `anchor`'s month, moved inside the months of `minDate…maxDate`.
    func clampMonth(_ anchor: Date, minDate: Date?, maxDate: Date?) -> Date {
        var month = startOfMonth(anchor)
        if let minDate, month < startOfMonth(minDate) { month = startOfMonth(minDate) }
        if let maxDate, month > startOfMonth(maxDate) { month = startOfMonth(maxDate) }
        return month
    }

    /// Very short weekday symbols ("M", "T", …) starting at the calendar's first weekday.
    func weekdaySymbols() -> [String] {
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        guard !symbols.isEmpty else { return [] }
        let first = max(0, min(calendar.firstWeekday - 1, symbols.count - 1))
        return Array(symbols[first...] + symbols[..<first])
    }
}
