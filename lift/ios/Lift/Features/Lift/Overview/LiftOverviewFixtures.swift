#if DEBUG
    import Foundation
    import KoboPatterns
    import LiftSync

    /// Named states for previews and snapshots, from the bundled made-up Lift body (TEST-8).
    extension LiftOverviewState {
        /// The demo body (`Resources/DemoAPI/app-lift.json`), decoded.
        static var fixtureOverview: LiftOverview? {
            guard let url = Bundle.main.url(forResource: "app-lift", withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(LiftOverview.self, from: data)
        }

        private static func loaded(_ overview: LiftOverview?) -> LiftOverviewState {
            LiftOverviewState(
                overview: AppResourceState(
                    content: overview.map { .loaded($0) } ?? .loading,
                    freshness: AppFreshness(text: "Updated 9:41 AM", isOffline: false)
                )
            )
        }

        static let fixtureDefault = loaded(fixtureOverview)
        static let fixtureExpanded: LiftOverviewState = {
            var state = loaded(fixtureOverview)
            state.isOlderSessionsExpanded = true
            state.isExercisesExpanded = true
            return state
        }()
        /// Nothing logged yet: the server's empty text in place of the sections.
        static let fixtureEmpty: LiftOverviewState = {
            var overview = fixtureOverview
            overview?.empty = LiftEmpty(
                title: "No sessions yet",
                body: "Log a workout and your progress shows up here."
            )
            return loaded(overview)
        }()
        /// Two sections the server could not load; the rest still shows.
        static let fixtureFailedSections: LiftOverviewState = {
            var overview = fixtureOverview
            overview?.lifts = .failed
            overview?.consistency = .failed
            return loaded(overview)
        }()
        static let fixtureLoading = LiftOverviewState()
        static let fixtureNotConnected = LiftOverviewState(overview: AppResourceState(content: .empty))
        static let fixtureFailed = LiftOverviewState(
            overview: AppResourceState(content: .failed(message: "Coach could not be reached. Pull down to try again."))
        )
    }
#endif
