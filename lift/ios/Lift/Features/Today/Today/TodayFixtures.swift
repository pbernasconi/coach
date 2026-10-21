#if DEBUG
    import Foundation
    import KoboPatterns
    import LiftCore
    import LiftSync

    /// Named states for previews and snapshots, from the bundled made-up Today body (TEST-8).
    extension TodayState {
        /// The demo body (`Resources/DemoAPI/app-today.json`), decoded.
        static var fixtureToday: AppToday? {
            guard let url = Bundle.main.url(forResource: "app-today", withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(AppToday.self, from: data)
        }

        private static func loaded(_ freshness: AppFreshness) -> TodayState {
            let today = fixtureToday
            let calendar = Calendar.autoupdatingCurrent.startingWeeksOnMonday()  // as CompositionRoot
            return TodayState(
                today: AppResourceState(content: today.map { .loaded($0) } ?? .loading, freshness: freshness),
                fitness: today?.fitness.value.map { TodayFitnessChart($0, calendar: calendar) }
            )
        }

        static let fixtureDefault = loaded(AppFreshness(text: "Updated 1:05 PM", isOffline: false))
        static let fixtureOffline = loaded(AppFreshness(text: "Offline · updated Mon, Oct 19", isOffline: true))
        static let fixtureLoading = TodayState()
        static let fixtureNotConnected = TodayState(today: AppResourceState(content: .empty))
        static let fixtureFailed = TodayState(
            today: AppResourceState(content: .failed(message: "Coach could not be reached. Pull down to try again."))
        )
    }
#endif
