import Foundation

/// Where a chat puts its quiet time lines, and what they read: "Today 08:01", "Yesterday 18:31", "Monday 11:33",
/// "Oct 26 at 11:33", "Oct 26, 2025 at 11:33". Pure, so it is tested on Linux.
public nonisolated enum ChatTimestampLogic {
    /// A pause longer than this starts a new group with its own time line.
    public static let defaultGap: TimeInterval = 60 * 60

    /// The rows (by offset) that get a time line above them: the first row, a row on a new day, and a row more than
    /// `gap` after the one before. A row without a date (just sent, not yet saved) counts as `now`.
    public static func separators(
        _ dates: [Date?],
        now: Date,
        gap: TimeInterval = defaultGap,
        calendar: Calendar = .current
    ) -> Set<Int> {
        var rows = Set<Int>()
        var previous: Date?
        for (offset, date) in dates.enumerated() {
            let date = date ?? now
            if let previous {
                if date.timeIntervalSince(previous) > gap || !calendar.isDate(date, inSameDayAs: previous) {
                    rows.insert(offset)
                }
            } else {
                rows.insert(offset)
            }
            previous = date
        }
        return rows
    }

    /// The line's words for `date`, read against `now`, in the calendar's locale and time zone.
    public static func label(for date: Date, now: Date, calendar: Calendar = .current) -> String {
        let time = date.formatted(style(.dateTime.hour().minute(), calendar))
        if calendar.isDate(date, inSameDayAs: now) { return String(localized: "Today \(time)", bundle: .module) }
        let days = dayCount(from: date, to: now, calendar: calendar)
        if days == 1 { return String(localized: "Yesterday \(time)", bundle: .module) }
        if (2..<7).contains(days) {
            let weekday = date.formatted(style(.dateTime.weekday(.wide), calendar))
            return "\(weekday) \(time)"
        }
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        let dayStyle = Date.FormatStyle.dateTime.month(.abbreviated).day()
        let day = date.formatted(style(sameYear ? dayStyle : dayStyle.year(), calendar))
        return String(localized: "\(day) at \(time)", bundle: .module)
    }

    /// Whole calendar days from `date` to `now` (1 = yesterday); negative for a date after today.
    static func dayCount(from date: Date, to now: Date, calendar: Calendar) -> Int {
        calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day
            ?? 0
    }

    private static func style(_ base: Date.FormatStyle, _ calendar: Calendar) -> Date.FormatStyle {
        var style = base
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        style.locale = calendar.locale ?? .current
        return style
    }
}
