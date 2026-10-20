import Foundation
import LiftCore

/// The Week API's two date forms: plain `YYYY-MM-DD` days and ISO 8601 stamps.
public enum CoachPlanDates {
    /// "2026-10-20" → that day; nil for anything else.
    public static func day(fromPlain text: String) -> LocalDay? {
        let parts = text.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
            let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
            (1...12).contains(month), (1...31).contains(day)
        else { return nil }
        return LocalDay(year: year, month: month, day: day)
    }

    /// The day as "2026-10-20".
    public static func plain(_ day: LocalDay) -> String {
        let month = day.month < 10 ? "0\(day.month)" : "\(day.month)"
        let date = day.day < 10 ? "0\(day.day)" : "\(day.day)"
        return "\(day.year)-\(month)-\(date)"
    }

    /// An ISO 8601 stamp, with or without fractional seconds.
    public static func date(fromISO text: String) -> Date? {
        if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text) { return date }
        return try? Date.ISO8601FormatStyle().parse(text)
    }
}
