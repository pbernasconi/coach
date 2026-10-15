import Foundation

/// The days a `DateField` or `KoboCalendar` accepts: an optional first and last day, and an optional rule that turns
/// single days off (rest days, holidays, days already full). Days compare by calendar day, never by time.
///
///     DateBounds(minDate: today, isDateDisabled: { calendar.isDateInWeekend($0) })
nonisolated public struct DateBounds: Sendable {
    /// The first selectable day, or `nil` for no lower bound.
    public var minDate: Date?
    /// The last selectable day, or `nil` for no upper bound.
    public var maxDate: Date?
    /// Turns single days off. It is asked only about days inside `minDate…maxDate`.
    public var isDateDisabled: (@Sendable (Date) -> Bool)?

    public init(minDate: Date? = nil, maxDate: Date? = nil, isDateDisabled: (@Sendable (Date) -> Bool)? = nil) {
        self.minDate = minDate
        self.maxDate = maxDate
        self.isDateDisabled = isDateDisabled
    }

    /// True when `day` falls on or after `minDate` and on or before `maxDate`, by calendar day.
    public func contains(_ day: Date, calendar: Calendar) -> Bool {
        !isBeforeMin(day, calendar: calendar) && !isAfterMax(day, calendar: calendar)
    }

    /// True when `day` is inside the bounds and not turned off.
    public func isSelectable(_ day: Date, calendar: Calendar) -> Bool {
        contains(day, calendar: calendar) && !(isDateDisabled?(calendar.startOfDay(for: day)) ?? false)
    }

    func isBeforeMin(_ day: Date, calendar: Calendar) -> Bool {
        guard let minDate else { return false }
        return calendar.startOfDay(for: day) < calendar.startOfDay(for: minDate)
    }

    func isAfterMax(_ day: Date, calendar: Calendar) -> Bool {
        guard let maxDate else { return false }
        return calendar.startOfDay(for: day) > calendar.startOfDay(for: maxDate)
    }
}
