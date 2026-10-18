import Foundation
import LiftCore

/// Calendar maths and day labels for the session lists. The calendar is injected: the app's starts weeks on Monday
/// (`Calendar.startingWeeksOnMonday()`, set once in `CompositionRoot`), and tests pin the time zone and locale.
///
/// The one date rule for every screen: `longTitle` ("Thursday, October 15") names a day where it is a title (a
/// screen's kicker, a section header); `shortTitle` ("Thu, Oct 15") names it inside a row, toast or caption, where
/// space is tight; `weekTitle` heads a week; `monthDayTitle` ("Oct 15") names a day on a chart (its axis, its "since"
/// caption), where the weekday adds nothing. No screen formats a day any other way.
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
        calendar.weekStart(of: day)
    }

    /// "Thursday, 15 October" in the calendar's locale.
    func longTitle(of day: LocalDay) -> String {
        format(day, style.weekday(.wide).month(.wide).day())
    }

    /// "Thu 15 Oct" in the calendar's locale.
    func shortTitle(of day: LocalDay) -> String {
        format(day, style.weekday(.abbreviated).month(.abbreviated).day())
    }

    /// "15 Oct" in the calendar's locale.
    func monthDayTitle(of day: LocalDay) -> String {
        format(day, style.month(.abbreviated).day())
    }

    /// "Week of 12 Oct" for the week starting on `start`.
    func weekTitle(start: LocalDay) -> String {
        String(localized: "Week of \(monthDayTitle(of: start))")
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
