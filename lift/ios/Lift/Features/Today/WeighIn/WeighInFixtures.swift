#if DEBUG
    import Foundation
    import LiftCore
    import LiftSync

    /// Named states for previews: the bundled demo body (made up, TEST-8).
    extension WeighInState {
        static var fixtureDefault: WeighInState {
            WeighInState(
                weighIn: AppResourceState(
                    content: WeighInDemoBody.value.map { .loaded($0) } ?? .loading,
                    freshness: AppFreshness(text: "Updated 9:41 AM", isOffline: false)
                ),
                chart: WeighInDemoBody.value.flatMap { WeighInChart.make($0, days: DayCalendar(calendar: .current)) },
                timeText: "7:12 AM",
                neighbours: [
                    WeighInNeighbour(
                        side: .earlier,
                        day: PlainDay(LocalDay(year: 2026, month: 10, day: 21)),
                        dayText: "Wed, Oct 21"
                    )
                ]
            )
        }
        static var fixtureFirst: WeighInState {
            let first = WeighInDemoBody.value.map { body in
                var first = body
                first.bodyFat = nil
                first.changes = []
                first.series = Array(body.series.suffix(1))
                first.trend?.rate = nil
                first.trend?.noteText = nil
                first.olderDate = nil
                first.source = nil
                return first
            }
            return WeighInState(weighIn: AppResourceState(content: first.map { .loaded($0) } ?? .loading))
        }
        static let fixtureLoading = WeighInState()
        static let fixtureNotConnected = WeighInState(weighIn: AppResourceState(content: .empty))
        static let fixtureFailed = WeighInState(
            weighIn: AppResourceState(content: .failed(message: "Coach has nothing here."))
        )
    }

    /// The bundled demo body (Resources/DemoAPI/app-weigh-ins-id.json), decoded for previews.
    enum WeighInDemoBody {
        static var value: AppWeighIn? {
            guard let url = Bundle.main.url(forResource: "app-weigh-ins-id", withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(AppWeighIn.self, from: data)
        }
    }
#endif
