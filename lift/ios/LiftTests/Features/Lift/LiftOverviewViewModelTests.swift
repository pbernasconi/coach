import Foundation
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// One test per Action of the Lift overview, and its load (TEST-2). Writes are awaited through `send(...)?.value`; no
/// sleeps and no real time (TEST-3).
@MainActor
@Suite struct LiftOverviewViewModelTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()

    /// The contract example with three more tips: a section link, a Week tab link and no link.
    private var body: Data {
        let tips = #"""
            { "id": "muscles", "tone": "info", "title": "Arms", "body": "…", "link": { "kind": "section", "section": "muscles" } },
            { "id": "plan", "tone": "info", "title": "Plan", "body": "…", "link": { "kind": "week" } },
            { "id": "protein", "tone": "good", "title": "Protein", "body": "…", "link": null },
            """#
        let gap = #"{ "id": "gap""#
        return Data(AppAPISamples.liftOverviewContract.replacingOccurrences(of: gap, with: tips + gap).utf8)
    }

    func loaded(_ results: [Result<Data, SyncTransportError>]? = nil) async -> (LiftOverviewViewModel, FakeAppData) {
        let data = FakeAppData(results ?? [.success(Data(AppAPISamples.liftOverviewContract.utf8))])
        let vm = LiftOverviewViewModel(
            data: data,
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, data)
    }

    @Test func runLoadsTheOverviewFromItsPath() async {
        let (vm, data) = await loaded()

        #expect(data.fetched == ["api/app/lift"])
        #expect(vm.state.overview.content.value?.unit == "lb")
        #expect(vm.state.overview.freshness?.isOffline == false)
    }

    @Test func runWithoutTheCoachSaysNotConnected() async {
        let data = FakeAppData()
        data.isConnected = false
        let vm = LiftOverviewViewModel(
            data: data,
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )

        await vm.run()

        #expect(vm.state.overview.content == .empty)
        #expect(data.fetched.isEmpty)
    }

    @Test func aFailedFirstLoadShowsAMessage() async {
        let (vm, _) = await loaded([.failure(.retryable(status: 500))])

        guard case .failed = vm.state.overview.content else {
            Issue.record("expected a failure, got \(vm.state.overview.content)")
            return
        }
    }

    @Test func refreshPulledFetchesAgain() async {
        let (vm, data) = await loaded()

        await vm.send(.refreshPulled)?.value

        #expect(data.fetched == ["api/app/lift", "api/app/lift"])
    }

    @Test func retryTappedShowsLoadingThenTheBody() async {
        let (vm, data) = await loaded([
            .failure(.retryable(status: 500)), .success(Data(AppAPISamples.liftOverviewContract.utf8)),
        ])

        let task = vm.send(.retryTapped)
        #expect(vm.state.overview.content == .loading)
        await task?.value

        #expect(vm.state.overview.content.value != nil)
        #expect(data.fetched.count == 2)
    }

    @Test func sessionTappedOpensTheSessionLowerCased() async {
        let (vm, _) = await loaded()

        vm.send(.sessionTapped("CA4F651B-98C7-4765-83A9-07AB74435D69"))

        #expect(router.opened == [.liftSession("ca4f651b-98c7-4765-83a9-07ab74435d69")])
    }

    @Test func exerciseTappedOpensTheExercise() async {
        let (vm, _) = await loaded()

        vm.send(.exerciseTapped("name-dip"))

        #expect(router.opened == [.liftExercise("name-dip")])
    }

    @Test func weeklyTappedOpensWeeklyVolume() async {
        let (vm, _) = await loaded()

        vm.send(.weeklyTapped)

        #expect(router.opened == [.liftWeekly])
    }

    @Test func tipTappedOpensItsSessionOrExercise() async {
        let (vm, _) = await loaded()

        vm.send(.tipTapped("gap"))
        vm.send(.tipTapped("stalled"))

        #expect(
            router.opened == [
                .liftSession("d5a25b33-32e0-5bcd-bc53-5f17cb084120"),
                .liftExercise("id-4c494654-0000-4000-8000-000000000019"),
            ]
        )
    }

    @Test func tipTappedWithASectionScrollsThereEachTime() async {
        let (vm, _) = await loaded([.success(body)])

        vm.send(.tipTapped("muscles"))
        let first = vm.state.scrollTarget
        vm.send(.tipTapped("muscles"))

        #expect(first?.section == .muscles)
        #expect(vm.state.scrollTarget?.section == .muscles)
        #expect(vm.state.scrollTarget != first)
        #expect(router.opened.isEmpty)
    }

    @Test func tipTappedWithAWeekLinkShowsTheWeekTab() async {
        let (vm, _) = await loaded([.success(body)])

        vm.send(.tipTapped("plan"))

        #expect(tabs.shown == [.week])
        #expect(router.opened.isEmpty)
        #expect(LiftTipsView.opens(.week) && LiftTipsView.opens(.section("records")))
    }

    @Test func tipTappedWithNoLinkDoesNothing() async {
        let (vm, _) = await loaded([.success(body)])

        vm.send(.tipTapped("protein"))
        vm.send(.tipTapped("unknown"))

        #expect(router.opened.isEmpty && tabs.shown.isEmpty)
        #expect(vm.state.scrollTarget == nil)
        #expect(!LiftTipsView.opens(nil))
    }

    @Test func connectTappedShowsSettings() async {
        let (vm, _) = await loaded()

        vm.send(.connectTapped)

        #expect(tabs.shown == [.settings])
    }

    @Test func olderSessionsExpandedChangedFoldsAndUnfolds() async {
        let (vm, _) = await loaded()

        vm.send(.olderSessionsExpandedChanged(true))
        #expect(vm.state.isOlderSessionsExpanded)
        vm.send(.olderSessionsExpandedChanged(false))
        #expect(!vm.state.isOlderSessionsExpanded)
    }

    @Test func exercisesExpandedChangedFoldsAndUnfolds() async {
        let (vm, _) = await loaded()

        vm.send(.exercisesExpandedChanged(true))

        #expect(vm.state.isExercisesExpanded)
    }

    @Test func theSimpleOverviewDecodes() async throws {
        let (vm, _) = await loaded([RoutedAppData.demo("app-lift")])
        let overview = try #require(vm.state.overview.content.value)
        #expect(overview.summary?.value?.text == "1 of 2 sessions this week")
        let targeting = try #require(overview.targeting?.value)
        #expect(targeting.items.map(\.name) == ["Quads", "Back", "Chest", "Biceps"])
        #expect(targeting.items.first?.sessions.first?.done == true)
        #expect(overview.progress?.value?.items.isEmpty == false)
    }

    @Test func plainDaysBecomeTheStartOfThatDay() {
        let date = LiftDay.date("2026-03-02", calendar: SessionBuilder.calendar)

        #expect(date == ManualNow.start.addingTimeInterval(-9 * 3600))
        #expect(LiftDay.date("March 2", calendar: SessionBuilder.calendar) == nil)
    }
}
