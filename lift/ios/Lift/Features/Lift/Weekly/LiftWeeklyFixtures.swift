#if DEBUG
    import Foundation
    import LiftSync

    /// Named states for previews: the bundled demo body (made up, TEST-8).
    extension LiftWeeklyState {
        static var fixtureDefault: LiftWeeklyState {
            LiftWeeklyState(
                weekly: AppResourceState(
                    content: LiftDemoBodies.weekly.map { .loaded($0) } ?? .loading,
                    freshness: AppFreshness(text: "Updated 9:41 AM", isOffline: false)
                )
            )
        }
        static var fixtureEmpty: LiftWeeklyState {
            let weeks = LiftWeeklyWeeks(
                title: "Weekly volume",
                caption: "Weeks start on Monday.",
                emptyText: "No sessions yet.",
                items: []
            )
            return LiftWeeklyState(
                weekly: AppResourceState(content: .loaded(LiftWeekly(unit: "kg", weeks: .ok(weeks))))
            )
        }
        static let fixtureFailedSection = LiftWeeklyState(
            weekly: AppResourceState(content: .loaded(LiftWeekly(unit: "kg", weeks: .failed)))
        )
        static let fixtureLoading = LiftWeeklyState()
        static let fixtureNotConnected = LiftWeeklyState(weekly: AppResourceState(content: .empty))
        static let fixtureFailed = LiftWeeklyState(
            weekly: AppResourceState(content: .failed(message: "Coach could not be reached. Pull down to try again."))
        )
    }

    /// The bundled demo bodies (Resources/DemoAPI), decoded for previews.
    enum LiftDemoBodies {
        static var weekly: LiftWeekly? { decode("app-lift-weekly") }
        static var exercise: LiftExerciseStats? { decode("app-lift-exercises") }

        private static func decode<Value: Decodable>(_ name: String) -> Value? {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(Value.self, from: data)
        }
    }
#endif
