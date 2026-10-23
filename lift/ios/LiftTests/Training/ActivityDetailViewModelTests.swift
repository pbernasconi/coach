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

    @Test func panelTappedOpensThePanel() async {
        let (vm, _) = await loaded()
        vm.send(.panelTapped(.splits))
        #expect(vm.state.panel == .splits)
        vm.send(.destinationDismissed)
        #expect(vm.state.panel == nil)
    }

    @Test func activityTappedClosesAnOpenPanel() async {
        let (vm, _) = await loaded()
        vm.send(.panelTapped(.sameRoute))
        vm.send(.activityTapped("9000000090"))
        #expect(vm.state.destination == nil)
        #expect(router.opened == [.activity("9000000090")])
    }

    @Test func demoBodyHasTheGridAndOutdoorFlag() async {
        let (vm, _) = await loaded()
        let detail = vm.state.detail.content.value
        #expect(detail?.overview?.value?.gridStats.map(\.label).prefix(2) == ["Distance", "Pace"])
        #expect(detail?.header?.value?.outdoor == true)
    }

    @Test func feedbackSavesTheFeelOfTheActivity() async {
        let (vm, data) = await loaded()
        #expect(vm.state.shownFeedback?.item == "strava:9000000102")

        await vm.send(.feedback(.changed(.rpe(6))))?.value

        #expect(vm.state.shownFeedback?.rpe == 6)
        #expect(vm.state.feedback.save == .saved)
        #expect(data.puts == ["api/app/feedback"])
    }
}

/// The splits' bar lengths.
@Suite struct SplitBarMathTests {
    @Test(arguments: [
        (Double?.some(3), [2.0, 3.0], Double?.some(1)),
        (Double?.some(2), [2.0, 3.0], Double?.some(SplitBarMath.shortest)),
        (Double?.some(2.5), [2.0, 3.0], Double?.some(0.7)),
        (Double?.some(2), [2.0, 2.0], Double?.some(1)),
        (Double?.none, [2.0, 3.0], Double?.none),
        (Double?.some(2), [], Double?.none),
    ])
    func fraction(speed: Double?, speeds: [Double], expected: Double?) {
        let got = SplitBarMath.fraction(speed, of: speeds)
        #expect(got.map { ($0 * 1000).rounded() } == expected.map { ($0 * 1000).rounded() })
    }
}
