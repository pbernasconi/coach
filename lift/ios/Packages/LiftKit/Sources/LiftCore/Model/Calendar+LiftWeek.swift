import Foundation

/// Lift's one week rule: weeks start on Monday, whatever the locale. The composition root applies it to the app's one
/// `Calendar`, so the Week strip, the month calendar, History's weeks, weekly volume and "Plan next week" all agree.
/// The locale still names the days and the time zone still decides them.
extension Calendar {
    /// Monday, counted the way `Calendar.firstWeekday` counts (Sunday is 1).
    public static let liftFirstWeekday = 2

    /// This calendar with weeks starting on Monday; everything else (identifier, locale, time zone) unchanged.
    public func startingWeeksOnMonday() -> Calendar {
        var calendar = self
        calendar.firstWeekday = Self.liftFirstWeekday
        return calendar
    }

    /// The first day of the week that contains `day`, or `day` itself when the calendar cannot build it.
    public func weekStart(of day: LocalDay) -> LocalDay {
        guard let date = day.startDate(in: self), let start = dateInterval(of: .weekOfYear, for: date)?.start else {
            return day
        }
        return LocalDay(start, calendar: self)
    }
}
