#if DEBUG
    import Foundation
    import KoboPatterns

    /// The made-up demo bodies in `Resources/DemoAPI` (written by `scripts/make-training-fixtures.mjs`), decoded for
    /// fixtures and previews. Fake data only (TEST-8).
    enum TrainingSamples {
        static var activities: ActivityListPage? { decode("app-activities") }
        static var activitiesPage2: ActivityListPage? { decode("app-activities-before-9000000075") }
        static var trends: TrendsResponse? { decode("app-trends") }
        static var run: ActivityDetail? { decode("app-activities-id") }
        static var ride: ActivityDetail? { decode("app-activities-9000000103") }
        static var pending: ActivityDetail? { decode("app-activities-9000000104") }

        /// A loaded resource state, or a failure naming the missing file.
        static func loaded<Value>(_ value: Value?) -> AppResourceState<Value> {
            guard let value else { return AppResourceState(content: .failed(message: "Demo body missing")) }
            return AppResourceState(
                content: .loaded(value),
                freshness: AppFreshness(text: "Updated 1:05 PM", isOffline: false)
            )
        }

        static func decode<Value: Decodable>(_ name: String) -> Value? {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(Value.self, from: data)
        }
    }
#endif
