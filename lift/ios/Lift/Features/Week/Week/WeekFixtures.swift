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

        static func day(_ offset: Int) -> LocalDay {
            SessionSummary.fixtureDay.adding(days: offset)
        }

        static let strip = WeekStrip(
            today: thursday,
            selected: thursday,
            days: [
                WeekDay(date: date(-3), status: .done),
                WeekDay(date: date(1), status: .planned),
            ]
        )

        private static let dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        /// A day of the week of 2 March, `offset` days from today (Thursday 5 March).
        static func section(
            _ offset: Int,
            sessions: [SessionSummary] = [],
            items: [WeekEntry] = [],
            selected: Bool = false
        ) -> WeekDaySection {
            let name = dayNames[offset + 3]
            let long = "\(name), \(5 + offset) March"
            return WeekDaySection(
                id: day(offset),
                title: offset == 0 ? "Today · \(long)" : long,
                weekday: String(name.prefix(3)),
                dayNumber: "\(5 + offset)",
                isToday: offset == 0,
                isSelected: selected,
                entries: items + sessions.map(WeekEntry.session)
            )
        }

        /// The week of 2 March with `sessions` on the days given (offsets from today); today is selected.
        private static func week(_ sessions: [Int: [SessionSummary]] = [:]) -> [WeekDaySection] {
            (-3...3).map { section($0, sessions: sessions[$0] ?? [], selected: $0 == 0) }
        }

        /// Monday done, today (Thursday) selected with nothing planned, Friday planned, the rest rest days.
        private static let sections = week([
            -3: [SessionSummary.fixtureLower.moved(to: day(-3))],
            1: [SessionSummary.fixtureUpper.moved(to: day(1))],
        ])

        private static let upperRef = WeekSessionRef(
            id: SessionSummary.fixtureUpper.id,
            title: "Upper A",
            dayTitle: "Friday, 6 March"
        )

        static let fixtureDefault = WeekState(strip: strip, sessions: .loaded(sections))
        static let fixtureLoading = WeekState(strip: strip, sessions: .loading)
        /// Nothing planned this week: seven rest days.
        static let fixtureEmpty = WeekState(
            strip: strip,
            sessions: .loaded(week()),
            templates: [
                WeekTemplateChoice(
                    id: UUID(uuid: (0xD1, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1)),
                    name: "Upper A"
                )
            ]
        )
        /// A first launch: no sessions and no templates, so the page points to New template.
        static let fixtureFirstRun = WeekState(strip: strip, sessions: .loaded(week()))
        static let fixtureFailed = WeekState(strip: strip, sessions: .failed(.unknown))
        static let fixtureLongText = WeekState(
            strip: strip,
            sessions: .loaded(week([0: [SessionSummary.fixtureLongTitle]]))
        )
        /// Two sessions on Friday: the date badge shows once.
        static let fixtureTwoOnADay = WeekState(
            strip: strip,
            sessions: .loaded(
                week([
                    1: [
                        SessionSummary.fixtureUpper.moved(to: day(1)),
                        SessionSummary.fixtureLower.moved(to: day(1)),
                    ]
                ])
            )
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
