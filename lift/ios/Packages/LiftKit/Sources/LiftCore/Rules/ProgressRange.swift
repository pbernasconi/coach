import Foundation

/// How far back an exercise's progress chart looks: the last 3 or 6 months, the last year, or every session.
public enum ProgressRange: String, CaseIterable, Hashable, Sendable {
    case threeMonths
    case sixMonths
    case year
    case all

    /// The first day the range includes when it ends on `today`, or nil for `.all`. A month back from the 31st lands
    /// on the last day of the shorter month (May 31 → Feb 28).
    public func firstDay(today: LocalDay) -> LocalDay? {
        switch self {
        case .threeMonths: today.adding(months: -3)
        case .sixMonths: today.adding(months: -6)
        case .year: today.adding(months: -12)
        case .all: nil
        }
    }
}

extension LocalDay {
    /// The same day `months` months later (or earlier, when negative), clamped to the end of a shorter month.
    public func adding(months: Int) -> LocalDay {
        let index = year * 12 + (month - 1) + months
        let year = index >= 0 ? index / 12 : (index - 11) / 12
        let month = index - year * 12 + 1
        return LocalDay(year: year, month: month, day: min(day, LocalDay.days(inMonth: month, of: year)))
    }

    /// How many days `month` of `year` has.
    static func days(inMonth month: Int, of year: Int) -> Int {
        let first = LocalDay(year: year, month: month, day: 1)
        let next = LocalDay(year: month == 12 ? year + 1 : year, month: month % 12 + 1, day: 1)
        return next.daysSinceEpoch - first.daysSinceEpoch
    }
}
