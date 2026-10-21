import Foundation
import KoboPatterns
import LiftSync
import Testing

@testable import Lift

/// One test per Action, plus `run()` (TEST-2): both pages load, paging follows the server's cursor, failures stay local.
@MainActor
@Suite struct TrainingViewModelTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()
    static let page2Key = "api/app/activities?before=9000000075&limit=30"

    func makeData(_ extra: [String: Result<Data, SyncTransportError>] = [:]) -> RoutedAppData {
        var answers: [String: Result<Data, SyncTransportError>] = [
            ActivityListPage.path: RoutedAppData.demo("app-activities"),
            TrendsResponse.path: RoutedAppData.demo("app-trends"),
            Self.page2Key: RoutedAppData.demo("app-activities-before-9000000075"),
        ]
        answers.merge(extra) { $1 }
        return RoutedAppData(answers)
    }

    func loaded(_ data: RoutedAppData? = nil, segment: TrainingSegment = .activities) async -> TrainingViewModel {
        let vm = TrainingViewModel(
            data: data ?? makeData(),
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            segment: segment
        )
        await vm.run()
        return vm
    }

    @Test func runLoadsTheFirstPageAndTrends() async {
        let vm = await loaded()
        #expect(vm.state.rows.count == 30)
        #expect(vm.state.nextCursor == "9000000075")
        #expect(vm.state.footer.phase == .idle)
        #expect(vm.state.trends.content.value?.performance.value?.tiles.count == 4)
    }

    @Test func notConnectedShowsEmpty() async {
        let data = makeData()
        data.isConnected = false
        let vm = await loaded(data)
        #expect(vm.state.list.content == .empty)
        #expect(vm.state.trends.content == .empty)
    }

    @Test func segmentChangedShowsTrends() async {
        let vm = await loaded()
        vm.send(.segmentChanged(.trends))
        #expect(vm.state.segment == .trends)
    }

    @Test func activityTappedOpensTheActivity() async {
        let vm = await loaded()
        vm.send(.activityTapped("9000000102"))
        #expect(router.opened == [.activity("9000000102")])
    }

    @Test func loadMoreTappedAppendsTheNextPageUntilTheEnd() async {
        let data = makeData()
        let vm = await loaded(data)
        await vm.send(.loadMoreTapped)?.value
        #expect(data.fetched.contains(Self.page2Key))
        #expect(vm.state.rows.count == 40)
        #expect(vm.state.nextCursor == nil)
        #expect(vm.state.footer.phase == .exhausted)
        #expect(vm.send(.loadMoreTapped) == nil, "no cursor, no request")
    }

    @Test func loadMoreFailureKeepsTheRowsAndCanTryAgain() async {
        let data = makeData([Self.page2Key: .failure(.retryable(status: 503))])
        let vm = await loaded(data)
        await vm.send(.loadMoreTapped)?.value
        #expect(vm.state.footer.phase == .failed)
        #expect(vm.state.rows.count == 30)
        data.answers[Self.page2Key] = RoutedAppData.demo("app-activities-before-9000000075")
        await vm.send(.loadMoreTapped)?.value
        #expect(vm.state.rows.count == 40)
    }

    @Test func aRepeatedPageEndsTheList() async {
        let data = makeData([Self.page2Key: RoutedAppData.demo("app-activities")])
        let vm = await loaded(data)
        await vm.send(.loadMoreTapped)?.value
        #expect(vm.state.rows.count == 30)
        #expect(vm.state.footer.phase == .exhausted)
    }

    @Test func aReturnToTheTabKeepsTheLoadedPages() async {
        let vm = await loaded()
        await vm.send(.loadMoreTapped)?.value
        await vm.run()  // the Screen's .task runs again after a pop or a tab switch
        #expect(vm.state.rows.count == 40)
        #expect(vm.state.footer.phase == .exhausted)
    }

    @Test func aPageFromBeforeARefreshIsDropped() async {
        let data = makeData()
        let vm = await loaded(data)
        let more = vm.send(.loadMoreTapped)
        await vm.send(.refreshPulled)?.value
        await more?.value
        // Either order keeps the list whole: page 2 lands only while its cursor is still the list's cursor.
        #expect(Set(vm.state.rows.map(\.id)).count == vm.state.rows.count)
    }

    @Test func refreshPulledStartsThePagingAgain() async {
        let vm = await loaded()
        await vm.send(.loadMoreTapped)?.value
        await vm.send(.refreshPulled)?.value
        #expect(vm.state.rows.count == 30)
        #expect(vm.state.nextCursor == "9000000075")
    }

    @Test func aPageThatLandsAfterARefreshIsDropped() async {
        let data = makeData()
        data.hold(Self.page2Key)
        let vm = await loaded(data)
        let more = vm.send(.loadMoreTapped)
        while !data.fetched.contains(Self.page2Key) { await Task.yield() }
        await vm.send(.refreshPulled)?.value
        data.release(Self.page2Key)
        await more?.value
        #expect(vm.state.rows.count == 30, "the old page 2 is not added to the fresh list")
        #expect(vm.state.nextCursor == "9000000075")
        #expect(vm.state.footer.phase == .idle)
    }

    @Test func activitiesRetryTappedLoadsAfterAFailure() async {
        let data = makeData([ActivityListPage.path: .failure(.retryable(status: nil))])
        let vm = await loaded(data)
        #expect(vm.state.list.content.phase == .failed)
        #expect(vm.state.trends.content.value != nil, "Trends does not fail with the list")
        data.answers[ActivityListPage.path] = RoutedAppData.demo("app-activities")
        await vm.send(.activitiesRetryTapped)?.value
        #expect(vm.state.rows.count == 30)
    }

    @Test func trendsRetryTappedLoadsAfterAFailure() async {
        let data = makeData([TrendsResponse.path: .failure(.rejected(status: 404))])
        let vm = await loaded(data)
        #expect(vm.state.trends.content.phase == .failed)
        data.answers[TrendsResponse.path] = RoutedAppData.demo("app-trends")
        await vm.send(.trendsRetryTapped)?.value
        #expect(vm.state.trends.content.value != nil)
    }

    @Test func trendsWithFailedSectionsStillShow() async {
        let body =
            #"{"performance":{"ok":false},"ramp":{"ok":true,"rates":[]},"peaks":{"ok":false},"lift":{"ok":false}}"#
        let vm = await loaded(makeData([TrendsResponse.path: .success(Data(body.utf8))]))
        let trends = vm.state.trends.content.value
        #expect(trends?.performance == .failed)
        #expect(trends?.ramp.value?.rates.isEmpty == true)
    }

    @Test func peaksWindowChangedPicksTheWindow() async {
        let vm = await loaded()
        vm.send(.peaksWindowChanged("d90"))
        #expect(vm.state.peaksWindow == "d90")
    }

    @Test func connectTappedShowsSettings() async {
        let vm = await loaded()
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func mainLiftTappedOpensTheExercise() async {
        let vm = await loaded()
        vm.send(.mainLiftTapped("demo-squat"))
        #expect(router.opened == [.liftExercise("demo-squat")])
    }
}
