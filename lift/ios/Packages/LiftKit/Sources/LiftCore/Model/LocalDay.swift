import Foundation

/// A calendar day with no time or time zone, so a session logged on "Sept 29" stays on Sept 29
/// wherever the device travels.
public struct LocalDay: Codable, Hashable, Comparable, Sendable {
    public var year: Int
    public var month: Int
    public var day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// The day `date` falls on in `calendar`.
    public init(_ date: Date, calendar: Calendar) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: parts.year ?? 0, month: parts.month ?? 0, day: parts.day ?? 0)
    }

    /// The start of this day in `calendar`, or nil if the day does not exist (for example Feb 30).
    public func startDate(in calendar: Calendar) -> Date? {
        let parts = DateComponents(year: year, month: month, day: day)
        guard parts.isValidDate(in: calendar) else { return nil }
        return calendar.date(from: parts)
    }

    public static func < (lhs: LocalDay, rhs: LocalDay) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}
