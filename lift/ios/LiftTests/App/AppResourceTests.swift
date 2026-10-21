import Foundation
import KoboPatterns
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// `AppResource`: the kept body first, then the fetch; offline over a kept body; failure with nothing kept; not
/// connected; and the demo source's file names. `SessionBuilder.now` is Monday 2026-03-02 09:00 UTC.
@MainActor
@Suite struct AppResourceTests {
    let days = DayCalendar(calendar: SessionBuilder.calendar)
    let body = Data(AppAPISamples.todayContract.utf8)

    func resource(_ source: FakeAppData) -> AppResource<AppToday> {
        AppResource(path: AppToday.path, source: source, now: SessionBuilder.now, days: days)
    }

    func run(_ source: FakeAppData, current: AppResourceState<AppToday> = AppResourceState()) async
        -> [AppResourceState<AppToday>]
    {
        var steps: [AppResourceState<AppToday>] = []
        await resource(source).load(current: current) { steps.append($0) }
        return steps
    }

    func time(_ date: Date) -> String { days.timeTitle(of: date) }

    @Test func showsTheKeptBodyThenTheFetchedOne() async throws {
        let source = FakeAppData([.success(body)])
        let keptAt = Date(timeIntervalSince1970: 1_772_442_000)  // 09:00
        source.keptBodies[AppToday.path] = AppAPIKept(data: body, fetchedAt: keptAt)
        let steps = await run(source)
        #expect(steps.count == 2)
        #expect(steps[0].freshness == AppFreshness(text: "Updated \(time(keptAt))", isOffline: false))
        #expect(steps[1].freshness == AppFreshness(text: "Updated \(time(source.fetchedAt))", isOffline: false))
        #expect(steps[1].content.value?.dateText == "Tuesday, October 20")
        #expect(source.fetched == [AppToday.path])
    }

    @Test func aFailedFetchKeepsTheKeptBodyAndSaysOffline() async {
        let source = FakeAppData([.failure(.retryable(status: nil))])
        let keptAt = Date(timeIntervalSince1970: 1_772_442_000)
        source.keptBodies[AppToday.path] = AppAPIKept(data: body, fetchedAt: keptAt)
        let last = await run(source).last
        #expect(last?.content.value != nil)
        #expect(last?.freshness == AppFreshness(text: "Offline · updated \(time(keptAt))", isOffline: true))
    }

    @Test(arguments: [
        (SyncTransportError.retryable(status: 500), "Coach could not be reached. Pull down to try again."),
        (.unauthorized, "Coach refused the sync token. Connect Lift again in Settings."),
        (.rejected(status: 404), "Coach has nothing here."),
        (.invalidResponse, "Coach sent something Lift cannot read."),
    ])
    func aFailureWithNothingKeptSaysWhy(error: SyncTransportError, message: String) async {
        let last = await run(FakeAppData([.failure(error)])).last
        #expect(last?.content == .failed(message: message))
    }

    @Test func aBodyLiftCannotReadFails() async {
        let last = await run(FakeAppData([.success(Data("{}".utf8))])).last
        #expect(last?.content == .failed(message: "Coach sent something Lift cannot read."))
    }

    @Test func notConnectedIsEmptyAndFetchesNothing() async {
        let off = FakeAppData()
        off.isConnected = false
        #expect(await run(off).last?.content == .empty)
        #expect(off.fetched.isEmpty)
        #expect(await run(FakeAppData([.failure(.missingToken)])).last?.content == .empty)
    }

    @Test func cacheKeysAddTheQuery() {
        #expect(
            appCacheKey("api/app/activities", [URLQueryItem(name: "before", value: "x")])
                == "api/app/activities?before=x"
        )
    }

    @Test func theDemoTodayBodyDecodesWithEverySection() async throws {
        let demo = DemoAppData(bundle: .main, now: SessionBuilder.now)
        let today = try JSONDecoder().decode(AppToday.self, from: try await demo.fetch(AppToday.path).data)
        #expect(today.fitness.value?.days.count ?? 0 > 100)
        #expect(
            [today.header.value == nil, today.body.value == nil, today.lift.value == nil, today.goals.value == nil]
                == [false, false, false, false]
        )
    }
}

/// The demo file names: a `before` cursor, the id body, then the parent.
@Suite struct DemoAppDataNameTests {
    @Test func namesTryTheCursorTheIdBodyAndTheParent() {
        #expect(DemoAppData.resourceNames(for: "api/app/today") == ["app-today"])
        #expect(
            DemoAppData.resourceNames(for: "api/app/activities/42")
                == ["app-activities-42", "app-activities-id", "app-activities"]
        )
        let page = [URLQueryItem(name: "before", value: "9"), URLQueryItem(name: "limit", value: "30")]
        #expect(
            DemoAppData.resourceNames(for: "api/app/activities", query: page) == [
                "app-activities-before-9", "app-activities",
            ]
        )
    }
}
