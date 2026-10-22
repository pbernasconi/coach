import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The weigh-in screen a weigh-in notice opens: the demo body decodes, `run()` and each Action (TEST-2). No sleeps.
@MainActor
@Suite struct WeighInTests {
    let tabs = RecordingTabs()
    let router = RecordingNavigator()
    let body = Data(AppAPISamples.weighInContract.utf8)

    func loaded(_ source: FakeAppData, day: String = "2026-10-22") async -> WeighInViewModel {
        let vm = WeighInViewModel(
            day: day,
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
        let url = try #require(Bundle.main.url(forResource: "app-weigh-ins-id", withExtension: "json"))
        let weighIn = try JSONDecoder().decode(AppWeighIn.self, from: Data(contentsOf: url))
        #expect(weighIn.series.count > 1)
    }

    @Test func runLoadsTheDayAndItsNeighbours() async {
        let source = FakeAppData([.success(body)])
        let vm = await loaded(source)
        #expect(source.fetched == ["api/app/weigh-ins/2026-10-22"])
        #expect(vm.state.weighIn.content.value?.weight.text == "83.2")
        #expect(vm.state.neighbours.map(\.side) == [.earlier])
        #expect(vm.state.neighbours.first?.day == PlainDay(LocalDay(year: 2026, month: 10, day: 21)))
    }

    @Test func runLoadsOnce() async {
        let source = FakeAppData([.success(body)])
        let vm = await loaded(source, day: "latest")
        await vm.run()
        #expect(source.fetched == ["api/app/weigh-ins/latest"])
    }

    @Test func runIsEmptyWhenNotConnected() async {
        let source = FakeAppData()
        source.isConnected = false
        let vm = await loaded(source)
        #expect(vm.state.weighIn.content == .empty)
        #expect(vm.state.neighbours.isEmpty)
    }

    @Test func refreshPulledFetchesAgain() async {
        let source = FakeAppData([.success(body)])
        let vm = await loaded(source)
        await vm.send(.refreshPulled)?.value
        #expect(source.fetched.count == 2)
    }

    @Test func retryTappedLoadsAgainAfterAFailure() async {
        let source = FakeAppData([.failure(.rejected(status: 404)), .success(body)])
        let vm = await loaded(source)
        #expect(vm.state.weighIn.content.phase == .failed)
        await vm.send(.retryTapped)?.value
        #expect(vm.state.weighIn.content.value != nil)
    }

    @Test func connectTappedShowsSettings() async {
        let vm = await loaded(FakeAppData([.success(body)]))
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func dayTappedOpensThatDaysWeighIn() async {
        let vm = await loaded(FakeAppData([.success(body)]))
        vm.send(.dayTapped(PlainDay(LocalDay(year: 2026, month: 10, day: 21))))
        #expect(router.opened == [.weighIn("2026-10-21")])
    }

    @Test(arguments: [
        ("renpho", "From the Renpho scale"), ("garmin", "From Garmin"), ("apple_health", "From Apple Health"),
    ])
    func sourceText(source: String, text: String) {
        #expect(WeighInText.source(source) == text)
    }
}
