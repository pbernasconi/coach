#if DEBUG
    import Foundation
    import KoboPatterns
    import LiftCore
    import LiftSync

    /// Named states for previews and snapshots, from the bundled made-up bodies (TEST-8).
    extension TodayState {
        /// A bundled demo body (`Resources/DemoAPI/<name>.json`), decoded.
        private static func demo<Value: Decodable>(_ name: String, as _: Value.Type) -> Value? {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(Value.self, from: data)
        }

        /// The demo Today body (`app-today.json`): the date line and today's plan.
        static var fixtureToday: AppToday? { demo("app-today", as: AppToday.self) }

        /// The demo health body (`app-health.json`).
        static var fixtureHealth: AppHealth? { demo("app-health", as: AppHealth.self) }

        private static func loaded(_ freshness: AppFreshness, health: AppHealth? = fixtureHealth) -> TodayState {
            TodayState(
                today: AppResourceState(content: fixtureToday.map { .loaded($0) } ?? .loading, freshness: freshness),
                health: AppResourceState(content: health.map { .loaded($0) } ?? .loading, freshness: freshness)
            )
        }

        static let fixtureDefault = loaded(AppFreshness(text: "Updated 1:05 PM", isOffline: false))
        static let fixtureOffline = loaded(AppFreshness(text: "Offline · updated Mon, Oct 19", isOffline: true))
        /// Every health section failed: each shows its own quiet card.
        static let fixtureFailedSections = loaded(
            AppFreshness(text: "Updated 1:05 PM", isOffline: false),
            health: try? JSONDecoder().decode(
                AppHealth.self,
                from: Data(#"{"today":"2026-10-20","days":30,"status":{"ok":false},"emptyText":null}"#.utf8)
            )
        )
        static let fixtureLoading = TodayState()
        static let fixtureNotConnected = TodayState(health: AppResourceState(content: .empty))
        static let fixtureFailed = TodayState(
            health: AppResourceState(content: .failed(message: "Coach could not be reached. Pull down to try again."))
        )
    }
#endif
