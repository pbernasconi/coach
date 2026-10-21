import Foundation
import KoboPatterns
import LiftSync
import Testing

@testable import Lift

/// One test per Action, plus `run()` (TEST-2).
@MainActor
@Suite struct ActivityDetailViewModelTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()
    static let path = ActivityDetail.path("9000000102")

    func loaded(_ answer: Result<Data, SyncTransportError> = RoutedAppData.demo("app-activities-id"))
        async -> (ActivityDetailViewModel, RoutedAppData)
    {
        let data = RoutedAppData([Self.path: answer])
        let vm = ActivityDetailViewModel(
            activityID: "9000000102",
            data: data,
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, data)
    }

    @Test func runLoadsThePage() async {
        let (vm, data) = await loaded()
        #expect(data.fetched == [Self.path])
        #expect(vm.state.detail.content.value?.header?.value?.name == "Harbour loop")
        #expect(vm.state.detail.content.value?.power == nil)
    }

    @Test func retryTappedLoadsAfterAFailure() async {
        let (vm, data) = await loaded(.failure(.rejected(status: 404)))
        #expect(vm.state.detail.content == .failed(message: "Coach has nothing here."))
        data.answers[Self.path] = RoutedAppData.demo("app-activities-id")
        await vm.send(.retryTapped)?.value
        #expect(vm.state.detail.content.value != nil)
    }

    @Test func refreshPulledKeepsThePageOffline() async {
        let (vm, data) = await loaded()
        data.answers[Self.path] = .failure(.retryable(status: nil))
        await vm.send(.refreshPulled)?.value
        #expect(vm.state.detail.content.value != nil)
        #expect(vm.state.detail.freshness?.isOffline == true)
    }

    @Test func neighbourTappedReplacesThePage() async {
        let (vm, _) = await loaded()
        vm.send(.neighbourTapped("9000000101"))
        #expect(router.backCount == 1)
        #expect(router.opened == [.activity("9000000101")])
    }

    @Test func activityTappedPushesTheOtherActivity() async {
        let (vm, _) = await loaded()
        vm.send(.activityTapped("9000000090"))
        #expect(router.opened == [.activity("9000000090")])
        #expect(router.backCount == 0)
    }

    @Test func axisChangedSwitchesTheCharts() async {
        let (vm, _) = await loaded()
        vm.send(.axisChanged(.time))
        #expect(vm.state.axis == .time)
    }

    @Test func paceModeChangedPicksTheMode() async {
        let (vm, _) = await loaded()
        vm.send(.paceModeChanged("smoothed"))
        #expect(vm.state.paceMode == "smoothed")
    }

    @Test func connectTappedShowsSettings() async {
        let (vm, _) = await loaded()
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func mapExpandTappedThenDismissed() async {
        let (vm, _) = await loaded()
        vm.send(.mapExpandTapped)
        #expect(vm.state.destination == .map)
        vm.send(.destinationDismissed)
        #expect(vm.state.destination == nil)
    }
}
