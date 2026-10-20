#if DEBUG
    import Foundation
    import LiftCore
    import LiftSync

    /// Named states with the coach plan on: a mixed week of sports around the Lift sessions. Fake data only (TEST-8).
    extension WeekState {
        private static func item(
            _ id: String,
            _ offset: Int,
            _ title: String,
            sport: Sport,
            subtitle: String,
            state: CoachItemState,
            label: String
        ) -> WeekEntry {
            .plan(planItem(id, offset, title, sport: sport, subtitle: subtitle, state: state, label: label))
        }

        private static func planItem(
            _ id: String,
            _ offset: Int,
            _ title: String,
            sport: Sport,
            subtitle: String,
            state: CoachItemState,
            label: String
        ) -> WeekPlanItem {
            var item = CoachItem(
                id: id,
                date: day(offset),
                title: title,
                sport: sport.rawValue,
                subtitle: subtitle,
                state: state,
                stateLabel: label
            )
            if id == "intervals" {
                item.adapted = true
                item.why = "Raises the ceiling for the long climbs in the ski block."
                item.notes = "Indoor trainer. Keep cadence above 85."
                item.keyTargets = ["3 × 12:00 at 88–93% FTP"]
                item.steps = [
                    CoachStep(label: "Warm up", detail: "10:00 · 55–75% FTP"),
                    CoachStep(label: "3 ×", detail: "12:00 at 88–93% FTP, 4:00 easy"),
                    CoachStep(label: "Cool down", detail: "8:00 · 50% FTP"),
                ]
            }
            return WeekPlanItem(item, dayTitle: "Thursday, 5 March")
        }

        /// Today's intervals: adapted, with why, notes, a key target and steps.
        static let fixtureIntervals = planItem(
            "intervals",
            0,
            "Sweet spot 3 × 12",
            sport: .ride,
            subtitle: "07:00 · 60 min · 70 TSS",
            state: .today,
            label: "Today"
        )

        /// Monday rest, Tuesday a done run and the done Lower A, Wednesday a skipped swim, today the intervals, Friday
        /// Upper A and a missed ride, the weekend a long ride and a hike.
        private static let planSections: [WeekDaySection] = [
            section(
                -3,
                items: [item("rest", -3, "Rest day", sport: .rest, subtitle: "Recover", state: .planned, label: "Rest")]
            ),
            section(
                -2,
                sessions: [SessionSummary.fixtureLower],
                items: [
                    item(
                        "run",
                        -2,
                        "Easy run",
                        sport: .run,
                        subtitle: "07:00 · 40 min · 35 TSS",
                        state: .done,
                        label: "Done"
                    )
                ]
            ),
            section(
                -1,
                items: [
                    item(
                        "swim",
                        -1,
                        "Technique swim",
                        sport: .swim,
                        subtitle: "12:00 · 30 min",
                        state: .skipped,
                        label: "Skipped"
                    )
                ]
            ),
            section(0, items: [.plan(fixtureIntervals)], selected: true),
            section(
                1,
                sessions: [SessionSummary.fixtureUpper],
                items: [
                    item(
                        "spin",
                        1,
                        "Recovery spin",
                        sport: .ride,
                        subtitle: "30 min · 20 TSS",
                        state: .missed,
                        label: "Missed"
                    )
                ]
            ),
            section(
                2,
                items: [
                    item(
                        "long",
                        2,
                        "Long ride",
                        sport: .ride,
                        subtitle: "09:00 · 2:30 · 140 TSS",
                        state: .planned,
                        label: "Planned"
                    )
                ]
            ),
            section(
                3,
                items: [
                    item(
                        "hike",
                        3,
                        "Hike",
                        sport: .hike,
                        subtitle: "10:00 · 2:00 · 70 TSS",
                        state: .planned,
                        label: "Planned"
                    )
                ]
            ),
        ]

        private static let planHeader = WeekPlanHeader(
            title: "Build week 3",
            totals: "2/9 done · 2:10 of 9:00 · 140 of 520 TSS",
            freshness: "Updated 1:05 PM",
            isOffline: false
        )

        static let fixturePlan = WeekState(
            strip: strip,
            sessions: .loaded(planSections),
            canPlanNextWeek: true,
            plan: planHeader
        )
        static let fixturePlanOffline = WeekState(
            strip: strip,
            sessions: .loaded(planSections),
            plan: WeekPlanHeader(
                title: nil,
                totals: planHeader.totals,
                freshness: "Offline · updated Wed 4 Mar",
                isOffline: true
            )
        )
        static let fixturePlanItem = WeekState(
            strip: strip,
            sessions: .loaded(planSections),
            destination: .planItem(fixtureIntervals),
            plan: planHeader
        )
    }
#endif
