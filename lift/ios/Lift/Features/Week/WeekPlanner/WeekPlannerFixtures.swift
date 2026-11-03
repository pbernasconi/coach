#if DEBUG
    import Foundation

    /// Named states for previews and snapshots, from the demo's made-up week (`DemoAPI/app-plan-week.json`). Fake
    /// data only (TEST-8).
    extension WeekPlannerState {
        /// The demo week, with `edit` applied to its JSON first (a drafting or empty week).
        static func demoWeek(_ edit: (inout [String: Any]) -> Void = { _ in }) -> PlannerWeek? {
            guard
                let url = Bundle.main.url(forResource: "app-plan-week", withExtension: "json"),
                let data = try? Data(contentsOf: url),
                var json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            else { return nil }
            edit(&json)
            guard let edited = try? JSONSerialization.data(withJSONObject: json) else { return nil }
            return try? JSONDecoder().decode(PlannerWeek.self, from: edited)
        }

        private static func with(_ week: PlannerWeek?, step: Step = .draft) -> Self {
            var state = Self()
            if let week {
                state.week.content = .loaded(week)
                state.answers = week.answers ?? PlannerAnswers()
            } else {
                state.week.content = .failed(message: "The demo week is missing.")
            }
            state.step = step
            return state
        }

        /// The draft to review, with its last change and checks.
        static var fixtureProposed: Self { with(demoWeek()) }

        static var fixtureLastWeek: Self { with(demoWeek(), step: .lastWeek) }

        /// Your week: Fri away, the rest free.
        static var fixtureDays: Self {
            var state = with(demoWeek(), step: .days)
            state.answers = state.answers.with("2026-11-13", as: .away)
            return state
        }

        static var fixtureShape: Self { with(demoWeek(), step: .shape) }

        /// Coach drafting: the calendar only, and the drafting line.
        static var fixtureDrafting: Self {
            with(
                demoWeek { json in
                    json["state"] = "drafting"
                    json["days"] = (json["days"] as? [[String: Any]])?.map { day in
                        var day = day
                        day["sessions"] = []
                        day["totalText"] = NSNull()
                        return day
                    }
                }
            )
        }

        /// No plan yet: the start card.
        static var fixtureNone: Self {
            var state = fixtureDrafting
            let week = demoWeek { json in
                json["state"] = "none"
                json["days"] = (json["days"] as? [[String: Any]])?.map { day in
                    var day = day
                    day["sessions"] = []
                    return day
                }
            }
            if let week { state.week.content = .loaded(week) }
            return state
        }

        /// The long run's sheet open.
        static var fixtureSession: Self {
            var state = fixtureProposed
            let longRun = state.loaded?.sessions.first { $0.title == "Long run" }
            state.destination = longRun.map { Destination.session($0.index) }
            return state
        }

        static var fixtureReview: Self { with(demoWeek(), step: .review) }

        /// A change the coach did not make.
        static var fixtureRefused: Self {
            var state = fixtureProposed
            state.write = .failed("Coach is already changing this week. Try again in a minute.")
            return state
        }

        static var fixtureLoading: Self { Self() }
    }
#endif
