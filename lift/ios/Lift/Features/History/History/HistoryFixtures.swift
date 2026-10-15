#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension HistoryState {
        private static let thisWeek = HistoryWeek(
            id: LocalDay(year: 2026, month: 3, day: 2),
            title: "Week of 2 Mar",
            sessions: [
                HistorySession(summary: SessionSummary.fixtureUpper, dayTitle: "Thu 5 Mar"),
                HistorySession(summary: SessionSummary.fixtureLower, dayTitle: "Tue 3 Mar"),
            ]
        )

        private static let lastWeek = HistoryWeek(
            id: LocalDay(year: 2026, month: 2, day: 23),
            title: "Week of 23 Feb",
            sessions: [HistorySession(summary: SessionSummary.fixtureLower, dayTitle: "Wed 25 Feb")]
        )

        static let fixtureDefault = HistoryState(weeks: .loaded([thisWeek, lastWeek]))
        static let fixtureLoading = HistoryState(weeks: .loading)
        static let fixtureEmpty = HistoryState(weeks: .empty)
        static let fixtureFailed = HistoryState(weeks: .failed(.unknown))
        static let fixtureLongText = HistoryState(
            weeks: .loaded([
                HistoryWeek(
                    id: LocalDay(year: 2026, month: 3, day: 2),
                    title: "Week of 2 Mar",
                    sessions: [HistorySession(summary: SessionSummary.fixtureLongTitle, dayTitle: "Thu 5 Mar")]
                )
            ])
        )
    }
#endif
