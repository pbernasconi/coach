#if DEBUG
    import Foundation
    import LiftCore

    /// Named progress charts for previews. Made-up sessions only (TEST-8).
    extension ExerciseProgressState {
        private static let today = LocalDay(year: 2026, month: 3, day: 5)
        private static let builder = ExerciseProgressBuilder(
            days: DayCalendar(calendar: Calendar(identifier: .gregorian).startingWeeksOnMonday()),
            unit: .kg
        )

        /// Twelve weekly sessions of 5 reps, the load rising 2.5 kg a week with one lighter week.
        private static let weekly: [ProgressPoint] = (0..<12).map { week in
            let load = 80 + 2.5 * Double(week) - (week == 7 ? 5 : 0)
            return ProgressPoint(
                id: .fixture(UInt8(week + 1)),
                day: today.adding(days: -7 * (11 - week) - 1),
                estimate: OneRepMax.estimate(reps: 5, weight: .kg(load)),
                heaviest: .kg(load),
                topSet: TopSet(reps: 5, weight: .kg(load))
            )
        }

        private static func state(
            _ points: [ProgressPoint],
            range: ProgressRange = .threeMonths,
            selected: UUID? = nil
        ) -> ExerciseProgressState {
            ExerciseProgressState(
                range: range,
                chart: builder.chart(points, range: range, selectedID: selected, today: today)
            )
        }

        static let fixtureWeekly = state(weekly)
        static let fixtureSelected = state(weekly, selected: .fixture(10))
        static let fixtureSingle = state(Array(weekly.suffix(1)), range: .all)
        /// One session long ago: the 3-month range has none.
        static let fixtureEmptyRange = ExerciseProgressState(
            range: .threeMonths,
            chart: builder.chart(
                Array(weekly.prefix(1)),
                range: .threeMonths,
                selectedID: nil,
                today: today.adding(days: 200)
            )
        )
    }
#endif
