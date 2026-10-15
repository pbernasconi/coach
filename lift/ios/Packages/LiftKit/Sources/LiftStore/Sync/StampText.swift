import Foundation

/// A row stamp as text, to the millisecond, in the two forms sync meets: GRDB's stored "2026-10-15 07:30:00.123"
/// (UTC) and the wire's "2026-10-15T07:30:00.123Z". Converting text to text keeps every millisecond: a trip
/// through `Date` (a binary floating-point number of seconds) can land a hair under the stamp, and the ISO 8601
/// formatter truncates, so ".191" used to go out as ".190".
struct StampText: Hashable, Sendable {
    /// "2026-10-15"
    let day: String
    /// "07:30:00"
    let time: String
    /// 0...999
    let milliseconds: Int

    /// GRDB's stored form.
    var stored: String { "\(day) \(time).\(Self.pad(milliseconds, 3))" }

    /// The wire form (SYNC.md).
    var wire: String { "\(day)T\(time).\(Self.pad(milliseconds, 3))Z" }

    /// Parses GRDB's form ("2026-10-15 07:30:00", optional fraction). Digits past the third are dropped, as GRDB does.
    init?(stored text: String) {
        guard let match = text.wholeMatch(of: /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?/) else {
            return nil
        }
        self.init(day: match.1, time: match.2, fraction: match.3)
    }

    /// Parses the wire form in UTC ("…T07:30:00Z", optional fraction). Other offsets need `init(date:)`.
    init?(wire text: String) {
        guard let match = text.wholeMatch(of: /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z/) else {
            return nil
        }
        self.init(day: match.1, time: match.2, fraction: match.3)
    }

    /// `date` rounded to the nearest millisecond, in UTC.
    init(date: Date) {
        let total = Int64((date.timeIntervalSince1970 * 1000).rounded())
        let seconds = total >= 0 ? total / 1000 : (total - 999) / 1000
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? calendar.timeZone
        let parts = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: Date(timeIntervalSince1970: TimeInterval(seconds))
        )
        day = "\(Self.pad(parts.year ?? 0, 4))-\(Self.pad(parts.month ?? 0, 2))-\(Self.pad(parts.day ?? 0, 2))"
        time = "\(Self.pad(parts.hour ?? 0, 2)):\(Self.pad(parts.minute ?? 0, 2)):\(Self.pad(parts.second ?? 0, 2))"
        milliseconds = Int(total - seconds * 1000)
    }

    private init(day: Substring, time: Substring, fraction: Substring?) {
        self.day = String(day)
        self.time = String(time)
        let digits = String((fraction ?? "").prefix(3))
        milliseconds = Int(digits.padding(toLength: 3, withPad: "0", startingAt: 0)) ?? 0
    }

    private static func pad(_ number: Int, _ width: Int) -> String {
        let digits = String(number)
        return String(repeating: "0", count: max(0, width - digits.count)) + digits
    }
}
