import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// One test per Action, plus `run()` (TEST-2): sections that fail alone, the kept page offline, and where taps go.
@MainActor
@Suite struct TodayViewModelTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()
    let body = Data(AppAPISamples.todayContract.utf8)

    func makeViewModel(_ source: FakeAppData, plan: [CoachPlanSnapshot] = [.off]) -> TodayViewModel {
        TodayViewModel(
            data: source,
            coachPlan: FakeCoachPlan(plan),
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            anchor: nil
        )
    }

    func loaded(_ source: FakeAppData? = nil, plan: [CoachPlanSnapshot] = [.off]) async -> TodayViewModel {
        let vm = makeViewModel(source ?? FakeAppData([.success(body)]), plan: plan)
        await vm.run()
        return vm
    }

    @Test func runLoadsThePage() async {
        let vm = await loaded()
        let today = vm.state.today.content.value
        #expect(today?.header.value?.chips.count == 5)
        #expect(today?.lift.value?.next?.title == "Heavy barbell")
        #expect(vm.state.today.freshness?.isOffline == false)
    }

    @Test func aFailedSectionLeavesTheOthers() async {
        let vm = await loaded(FakeAppData([.success(Data(AppAPISamples.todayFailedSections.utf8))]))
        let today = vm.state.today.content.value
        #expect(today?.header.value?.emptyText == "No Garmin data today.")
        #expect(today?.fitness == .failed)
        #expect(today?.goals == .failed)
    }

    @Test func refreshPulledKeepsThePageOfflineWhenTheFetchFails() async {
        let source = FakeAppData([.success(body), .failure(.retryable(status: nil))])
        let vm = await loaded(source)
        await vm.send(.refreshPulled)?.value
        #expect(vm.state.today.content.value != nil)
        #expect(vm.state.today.freshness?.isOffline == true)
        #expect(source.fetched.count == 2)
    }

    @Test func retryTappedLoadsAgainAfterAFailure() async {
        let source = FakeAppData([.failure(.retryable(status: nil)), .success(body)])
        let vm = await loaded(source)
        #expect(vm.state.today.content.phase == .failed)
        await vm.send(.retryTapped)?.value
        #expect(vm.state.today.content.value != nil)
    }

    @Test func lineItemTappedOpensALiftSession() async {
        let vm = await loaded()
        vm.send(.lineItemTapped("ylfw7n0i8xabidggyzmge38q"))
        #expect(router.opened == [.liftSession("ca4f651b-98c7-4765-83a9-07ab74435d69")])
    }

    @Test func lineItemTappedOpensAPlanItemFromTheKeptWeek() async throws {
        let line = """
            {"generatedAt":"2026-03-02T09:00:00Z","timeZone":"UTC","today":"2026-03-02","dateText":"Monday",
            "header":{"ok":true,"chips":[]},"todayLine":{"ok":true,"items":[{"id":"ride","title":"Ride","sport":"ride",
            "state":"today","text":"07:00 · 1:00","liftSessionId":null}]}}
            """
        let book = CoachPlanBook([
            try CoachPlanSamples.plan(
                start: Fixtures.monday,
                items: [(Fixtures.monday, CoachPlanSamples.item("ride", on: Fixtures.monday))]
            )
        ])
        let vm = await loaded(
            FakeAppData([.success(Data(line.utf8))]),
            plan: [CoachPlanSnapshot(status: .ready, book: book)]
        )
        vm.send(.lineItemTapped("ride"))
        #expect(vm.state.planItemTarget?.id == "ride")
        #expect(router.opened.isEmpty)
        vm.send(.destinationDismissed)
        #expect(vm.state.destination == nil)
    }

    @Test func mainLiftTappedOpensTheExercise() async {
        let vm = await loaded()
        vm.send(.mainLiftTapped("id-4c494654-0000-4000-8000-000000000001"))
        #expect(router.opened == [.liftExercise("id-4c494654-0000-4000-8000-000000000001")])
    }

    @Test func liftSessionTappedOpensTheSession() async {
        let vm = await loaded()
        vm.send(.liftSessionTapped("d5a25b33-32e0-5bcd-bc53-5f17cb084120"))
        #expect(router.opened == [.liftSession("d5a25b33-32e0-5bcd-bc53-5f17cb084120")])
    }

    @Test func anAnchorFromTheLaunchIsInTheState() {
        let vm = TodayViewModel(
            data: FakeAppData(),
            coachPlan: FakeCoachPlan([]),
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            anchor: .end
        )
        #expect(vm.state.anchor == .end)
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-open", "today-end"]).todayAnchor == .end)
        #expect(LaunchOptions(arguments: ["Lift", "-open", "today-fitness"]).todayAnchor == nil)
    }

    @Test func connectTappedShowsSettings() async {
        let vm = await loaded()
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func planActivityTappedClosesTheSheetAndOpensTheActivity() async {
        let vm = await loaded()
        vm.send(.planActivityTapped("19015136492"))
        #expect(vm.state.destination == nil)
        #expect(router.opened == [.activity("19015136492")])
    }

    @Test func notConnectedShowsTheEmptyState() async {
        let off = FakeAppData()
        off.isConnected = false
        #expect(await loaded(off).state.today.content == .empty)
    }
}
