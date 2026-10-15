import Foundation

/// A one-tap date above the calendar of a `DateField`: "Today" and "Tomorrow" when they are selectable; when neither
/// is, one "Earliest" pick for a selectable `minDate`; else none, never a dead chip.
nonisolated enum DateQuickPick: Hashable, Sendable, Identifiable {
    case today(Date)
    case tomorrow(Date)
    case earliest(Date)

    /// Picks never share a day, so the day identifies one.
    var id: Date { date }

    var date: Date {
        switch self {
        case .today(let date), .tomorrow(let date), .earliest(let date): date
        }
    }

    static func picks(today: Date, bounds: DateBounds, calendar: Calendar) -> [DateQuickPick] {
        let start = calendar.startOfDay(for: today)
        let next = calendar.date(byAdding: .day, value: 1, to: start) ?? start
        let days: [DateQuickPick] = [.today(start), .tomorrow(next)]
        let selectable = days.filter { bounds.isSelectable($0.date, calendar: calendar) }
        if !selectable.isEmpty { return selectable }
        guard let earliest = bounds.minDate, bounds.isSelectable(earliest, calendar: calendar) else { return [] }
        return [.earliest(calendar.startOfDay(for: earliest))]
    }
}
