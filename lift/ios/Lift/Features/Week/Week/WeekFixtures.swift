#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension WeekState {
        /// Thursday 2026-03-05 at midnight UTC.
        private static let thursday = Date(timeIntervalSince1970: 1_772_668_800)

        private static func day(_ offset: Int) -> Date {
            thursday.addingTimeInterval(TimeInterval(offset) * 86_400)
        }

        private static let strip = WeekStrip(
            today: thursday,
            selected: thursday,
            title: "Today",
            days: [
                WeekDay(date: day(-3), status: .done),
                WeekDay(date: day(0), status: .planned),
                WeekDay(date: day(2), status: .planned),
            ]
        )

        static let fixtureDefault = WeekState(
            strip: strip,
            sessions: .loaded([SessionSummary.fixtureLower, SessionSummary.fixtureUpper])
        )
        static let fixtureLoading = WeekState(strip: strip, sessions: .loading)
        static let fixtureEmpty = WeekState(strip: strip, sessions: .empty)
        static let fixtureFailed = WeekState(strip: strip, sessions: .failed(.unknown))
        static let fixtureLongText = WeekState(strip: strip, sessions: .loaded([SessionSummary.fixtureLongTitle]))
    }
#endif
