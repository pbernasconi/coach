import Foundation

/// One page of a `DayStrip`: a week, identified by its offset from the week containing today.
nonisolated struct WeekPage: Identifiable, Hashable, Sendable {
    let id: Int
    let days: [DayItem]
}

/// Pure calendar maths for `DayStrip`. Week offsets count from the week that contains `today` (offset 0).
/// The calendar decides the first weekday (Sunday in the US, Monday in most of Europe).
nonisolated struct WeekMath: Sendable {
    let calendar: Calendar

    /// The number of days in a week for this calendar.
    var daysPerWeek: Int { calendar.weekdaySymbols.count }

    /// Midnight at the start of the week containing `date`.
    func startOfWeek(containing date: Date) -> Date {
        calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
    }

    /// The days (each at midnight) of the week `offset` weeks away from the week containing `today`.
    func days(inWeekAt offset: Int, from today: Date) -> [Date] {
        let thisWeek = startOfWeek(containing: today)
        guard let weekStart = calendar.date(byAdding: .weekOfYear, value: offset, to: thisWeek) else { return [] }
        return (0..<daysPerWeek).compactMap { calendar.date(byAdding: .day, value: $0, to: weekStart) }
    }

    /// The offset of the week containing `date` from the week containing `today` (negative in the past).
    func weekOffset(of date: Date, from today: Date) -> Int {
        let from = startOfWeek(containing: today)
        let to = startOfWeek(containing: date)
        let days = calendar.dateComponents([.day], from: from, to: to).day ?? 0
        return Int((Double(days) / Double(daysPerWeek)).rounded(.down))
    }

    /// Very short weekday symbols ("M", "T", …) starting at the calendar's first weekday.
    func weekdaySymbols() -> [String] {
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        let first = max(0, min(calendar.firstWeekday - 1, symbols.count - 1))
        return Array(symbols[first...] + symbols[..<first])
    }

    /// Pages for `weeks`, each day carrying the marker of the matching item (same calendar day).
    func pages(weeks: ClosedRange<Int>, today: Date, items: [DayItem]) -> [WeekPage] {
        let markers = Dictionary(
            items.map { (calendar.startOfDay(for: $0.date), $0.marker) },
            uniquingKeysWith: { _, last in last }
        )
        return weeks.map { offset in
            let dayItems = days(inWeekAt: offset, from: today).map { date in
                DayItem(date: date, marker: markers[date] ?? DayMarker.none)
            }
            return WeekPage(id: offset, days: dayItems)
        }
    }

    /// True when `date` falls on a day before `today`.
    func isPast(_ date: Date, today: Date) -> Bool {
        calendar.startOfDay(for: date) < calendar.startOfDay(for: today)
    }
}
