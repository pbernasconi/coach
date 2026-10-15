import Foundation

@testable import LiftCore

/// The fixed calendar every test uses: Gregorian, UTC, en_US_POSIX.
enum TestCalendar {
    static let gregorian: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? TimeZone(secondsFromGMT: 0) ?? calendar.timeZone
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return calendar
    }()

    /// Noon UTC on the given day, so time-zone slips cannot change the day.
    static func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        let parts = DateComponents(year: year, month: month, day: day, hour: 12)
        return gregorian.date(from: parts) ?? Date(timeIntervalSince1970: 0)
    }

    /// Ids 1, 2, 3… in call order, so imported ids are deterministic.
    static func sequentialIDs() -> () -> UUID {
        var next: UInt8 = 0
        return {
            next &+= 1
            return UUID(uuid: (0xAA, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, next))
        }
    }

    static func id(_ number: UInt8) -> UUID {
        UUID(uuid: (0xAA, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, number))
    }

    /// A done working set.
    static func done(_ reps: Int, _ weight: Weight?, kind: SetKind = .working) -> LoggedSet {
        LoggedSet(id: id(1), kind: kind, actual: SetActual(reps: reps, weight: weight))
    }
}
