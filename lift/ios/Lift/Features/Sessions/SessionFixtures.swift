#if DEBUG
    import Foundation
    import LiftCore

    /// Made-up sessions for the Week and History fixtures (TEST-8). Nothing here comes from a real log.
    extension SessionSummary {
        /// A fixed Thursday, 2026-03-05, so previews never read the clock.
        static let fixtureDay = LocalDay(year: 2026, month: 3, day: 5)

        static let fixtureLower = SessionSummary(
            id: .fixture(1),
            day: fixtureDay,
            title: "Lower A",
            exerciseCount: 5,
            loggedSets: 15,
            totalSets: 15,
            isDone: true
        )

        static let fixtureUpper = SessionSummary(
            id: .fixture(2),
            day: fixtureDay,
            title: "Upper A",
            exerciseCount: 4,
            loggedSets: 3,
            totalSets: 12,
            isDone: false
        )

        static let fixtureLongTitle = SessionSummary(
            id: .fixture(3),
            day: fixtureDay,
            title: "Full body with extra accessory work for the upper back and shoulders",
            exerciseCount: 1,
            loggedSets: 0,
            totalSets: 3,
            isDone: false
        )
    }

    extension UUID {
        /// A stable made-up id: `00000000-0000-4000-8000-0000000000NN`.
        nonisolated static func fixture(_ number: UInt8) -> UUID {
            UUID(uuid: (0, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, number))
        }
    }
#endif
