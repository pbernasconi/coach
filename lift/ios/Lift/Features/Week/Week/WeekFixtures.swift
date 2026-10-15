#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension WeekState {
        /// Thursday 2026-03-05 at midnight UTC.
        private static let thursday = Date(timeIntervalSince1970: 1_772_668_800)

        private static func date(_ offset: Int) -> Date {
            thursday.addingTimeInterval(TimeInterval(offset) * 86_400)
        }

        private static func day(_ offset: Int) -> LocalDay {
            SessionSummary.fixtureDay.adding(days: offset)
        }

        private static let strip = WeekStrip(
            today: thursday,
            selected: thursday,
            days: [
                WeekDay(date: date(-3), status: .done),
                WeekDay(date: date(1), status: .planned),
            ]
        )

        /// Monday done, today (Thursday) selected with nothing planned, Friday planned.
        private static let sections = [
            WeekDaySection(
                id: day(-3),
                title: "Monday, 2 March",
                isSelected: false,
                sessions: [SessionSummary.fixtureLower.moved(to: day(-3))]
            ),
            WeekDaySection(id: day(0), title: "Today · Thursday, 5 March", isSelected: true, sessions: []),
            WeekDaySection(
                id: day(1),
                title: "Friday, 6 March",
                isSelected: false,
                sessions: [SessionSummary.fixtureUpper.moved(to: day(1))]
            ),
        ]

        private static let upperRef = WeekSessionRef(
            id: SessionSummary.fixtureUpper.id,
            title: "Upper A",
            dayTitle: "Friday, 6 March"
        )

        static let fixtureDefault = WeekState(strip: strip, sessions: .loaded(sections))
        static let fixtureLoading = WeekState(strip: strip, sessions: .loading)
        static let fixtureEmpty = WeekState(strip: strip, sessions: .empty)
        static let fixtureFailed = WeekState(strip: strip, sessions: .failed(.unknown))
        static let fixtureLongText = WeekState(
            strip: strip,
            sessions: .loaded([
                WeekDaySection(
                    id: day(0),
                    title: "Today · Thursday, 5 March",
                    isSelected: true,
                    sessions: [SessionSummary.fixtureLongTitle]
                )
            ])
        )
        static let fixtureOptions = WeekState(
            strip: strip,
            sessions: .loaded(sections),
            destination: .options(upperRef)
        )
        static let fixtureMove = WeekState(
            strip: strip,
            sessions: .loaded(sections),
            destination: .move(
                WeekMove(
                    id: upperRef.id,
                    title: upperRef.title,
                    dayTitle: upperRef.dayTitle,
                    current: date(1),
                    first: date(-31),
                    last: date(34)
                )
            )
        )
    }

    extension SessionSummary {
        /// The same made-up session on another day.
        fileprivate func moved(to day: LocalDay) -> SessionSummary {
            SessionSummary(
                id: id,
                day: day,
                title: title,
                exerciseCount: exerciseCount,
                loggedSets: loggedSets,
                totalSets: totalSets,
                isDone: isDone
            )
        }
    }
#endif
