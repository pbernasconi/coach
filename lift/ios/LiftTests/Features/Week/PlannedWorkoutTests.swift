import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The planned workout page the Week list opens: the demo body decodes, `run()` and each Action (TEST-2). No sleeps.
@MainActor
@Suite struct PlannedWorkoutTests {
    let tabs = RecordingTabs()
    let router = RecordingNavigator()

    var body: Data {
        get throws {
            let url = try #require(Bundle.main.url(forResource: "app-plan-id", withExtension: "json"))
            return try Data(contentsOf: url)
        }
    }

    func loaded(_ source: FakeAppData) async -> PlannedWorkoutViewModel {
        let vm = PlannedWorkoutViewModel(
            planID: "demo-ride",
            data: source,
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return vm
    }

    @Test func theDemoBodyDecodes() throws {
        let workout = try JSONDecoder().decode(AppPlannedWorkout.self, from: try body)
        #expect(workout.workout?.steps.contains { $0.kind == "repeat" } == true)
        #expect(workout.workout?.zones?.items.count == 5)
    }

    @Test func runLoadsTheWorkout() async throws {
        let source = FakeAppData([.success(try body)])
        let vm = await loaded(source)
        #expect(source.fetched == ["api/app/plan/demo-ride"])
        #expect(vm.state.workout.content.value?.title == "Sweet spot 3 × 12")
    }

    @Test func runIsEmptyWhenNotConnected() async {
        let source = FakeAppData()
        source.isConnected = false
        let vm = await loaded(source)
        #expect(vm.state.workout.content == .empty)
    }

    @Test func refreshPulledFetchesAgain() async throws {
        let source = FakeAppData([.success(try body)])
        let vm = await loaded(source)
        await vm.send(.refreshPulled)?.value
        #expect(source.fetched.count == 2)
    }

    @Test func retryTappedLoadsAgainAfterAFailure() async throws {
        let source = FakeAppData([.failure(.rejected(status: 404)), .success(try body)])
        let vm = await loaded(source)
        #expect(vm.state.workout.content.phase == .failed)
        await vm.send(.retryTapped)?.value
        #expect(vm.state.workout.content.value != nil)
    }

    @Test func connectTappedShowsSettings() async throws {
        let vm = await loaded(FakeAppData([.success(try body)]))
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func activityTappedOpensTheActivity() async throws {
        let vm = await loaded(FakeAppData([.success(try body)]))
        vm.send(.activityTapped("9000000103"))
        #expect(router.opened == [.activity("9000000103")])
    }

    @Test func sessionTappedOpensTheLiftSession() async throws {
        let vm = await loaded(FakeAppData([.success(try body)]))
        vm.send(.sessionTapped("ABC"))
        #expect(router.opened == [.liftSession("abc")])
    }

    @Test(arguments: [("Z1", 0), ("Z3", 2), ("Z5", 4), ("Z9", 4), ("x", 0)])
    func zoneLevels(zone: String, level: Int) {
        #expect(PlannedZone.level(zone) == level)
    }
}
