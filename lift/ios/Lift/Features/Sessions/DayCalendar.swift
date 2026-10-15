import Foundation
import LiftCore

/// Calendar maths and day labels for the session lists. The calendar is injected, so weeks start on the person's
/// first weekday and tests can pin the time zone and locale.
nonisolated struct DayCalendar: Sendable {
    let calendar: Calendar

    /// The day `date` falls on.
    func day(of date: Date) -> LocalDay {
        LocalDay(date, calendar: calendar)
    }

    /// Midnight at the start of `day`, or nil for a day the calendar cannot build.
    func date(of day: LocalDay) -> Date? {
        day.startDate(in: calendar)
    }

    /// The first day of the week that contains `day`.
    func weekStart(of day: LocalDay) -> LocalDay {
        guard let date = date(of: day), let start = calendar.dateInterval(of: .weekOfYear, for: date)?.start else {
            return day
        }
        return LocalDay(start, calendar: calendar)
    }

    /// "Thursday, 15 October" in the calendar's locale.
    func longTitle(of day: LocalDay) -> String {
        format(day, style.weekday(.wide).month(.wide).day())
    }

    /// "Thu 15 Oct" in the calendar's locale.
    func shortTitle(of day: LocalDay) -> String {
        format(day, style.weekday(.abbreviated).month(.abbreviated).day())
    }

    /// "Week of 12 Oct" for the week starting on `start`.
    func weekTitle(start: LocalDay) -> String {
        let date = format(start, style.month(.abbreviated).day())
        return String(localized: "Week of \(date)")
    }

    private var style: Date.FormatStyle {
        Date.FormatStyle(
            locale: calendar.locale ?? .autoupdatingCurrent,
            calendar: calendar,
            timeZone: calendar.timeZone
        )
    }

    private func format(_ day: LocalDay, _ style: Date.FormatStyle) -> String {
        guard let date = date(of: day) else { return "" }
        return date.formatted(style)
    }
}
