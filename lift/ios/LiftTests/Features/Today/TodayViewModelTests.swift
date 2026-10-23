import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// One test per Action, plus `run()` (TEST-2): both pages load side by side, sections fail alone, the trends window
/// re-fetches, and where taps go.
@MainActor
@Suite struct TodayViewModelTests {
    let router = RecordingNavigator()
    let tabs = RecordingTabs()
    static let todayKey = AppToday.path
    static let health30 = appCacheKey(AppHealth.path, HealthRange.days30.query)
    static let health90 = appCacheKey(AppHealth.path, HealthRange.days90.query)

    /// The demo health body, as the server sends it for `days`.
    static func health(days: Int) -> Result<Data, SyncTransportError> {
        RoutedAppData.demo("app-health").map { data in
            Data(String(decoding: data, as: UTF8.self).replacingOccurrences(of: #""days": 30"#, with: #""days": \#(days)"#).utf8)
        }
    }

    static func source() -> RoutedAppData {
        RoutedAppData([todayKey: RoutedAppData.demo("app-today"), health30: health(days: 30), health90: health(days: 90)])
    }

    func makeViewModel(_ source: any AppDataSource, plan: [CoachPlanSnapshot] = [.off], anchor: TodayAnchor? = nil)
        -> TodayViewModel
    {
        TodayViewModel(
            data: source,
            coachPlan: FakeCoachPlan(plan),
            router: router,
            tabs: tabs,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            anchor: anchor
        )
    }

    func loaded(_ source: any AppDataSource = source(), plan: [CoachPlanSnapshot] = [.off]) async -> TodayViewModel {
        let vm = makeViewModel(source, plan: plan)
        await vm.run()
        return vm
    }

    @Test func runLoadsTodaysPlanAndTheHealthPage() async {
        let source = Self.source()
        let vm = await loaded(source)
        let health = vm.state.health.content.value
        #expect(Set(source.fetched) == [Self.todayKey, Self.health30])
        #expect(vm.state.today.content.value?.todayLine.value?.items.count == 2)
        #expect(health?.days == 30)
        #expect(health?.readiness.value?.label == "Take it easy")
        #expect(health?.vitals.value?.items.map(\.key).first == "hrv")
        #expect(health?.trends.value?.items.count == 10)
        #expect(health?.body.value?.dexa?.measures.count == 4)
        #expect(health?.labs.value?.counts.outOfRange == 3)
    }

    @Test func aFailedSectionLeavesTheOthers() async {
        let body = #"{"today":"2026-10-20","days":30,"status":{"ok":false},"labs":{"ok":true,"drawDateText":null,"#
            + #""drawCount":0,"counts":{"total":0,"inRange":0,"outOfRange":0,"noRange":0},"items":[],"moreCount":0}}"#
        let source = Self.source()
        source.answers[Self.health30] = .success(Data(body.utf8))
        let health = await loaded(source).state.health.content.value
        #expect(health?.status == .failed)
        #expect(health?.vitals == .failed)
        #expect(health?.labs.value?.counts.total == 0)
    }

    @Test func aFailedPlanStillShowsTheHealthPage() async {
        let source = Self.source()
        source.answers[Self.todayKey] = .failure(.retryable(status: nil))
        let vm = await loaded(source)
        #expect(vm.state.today.content.phase == .failed)
        #expect(vm.state.health.content.value != nil)
    }

    @Test func refreshPulledFetchesBothAgainAndKeepsThePageOffline() async {
        let source = Self.source()
        let vm = await loaded(source)
        source.answers[Self.health30] = .failure(.retryable(status: nil))
        await vm.send(.refreshPulled)?.value
        #expect(source.fetched.count == 4)
        #expect(vm.state.health.content.value != nil)
        #expect(vm.state.health.freshness?.isOffline == true)
    }

    @Test func retryTappedLoadsAgainAfterAFailure() async {
        let source = Self.source()
        source.answers[Self.health30] = .failure(.retryable(status: nil))
        let vm = await loaded(source)
        #expect(vm.state.health.content.phase == .failed)
        source.answers[Self.health30] = Self.health(days: 30)
        await vm.send(.retryTapped)?.value
        #expect(vm.state.health.content.value != nil)
    }

    @Test func trendRangeChangedFetchesTheOtherWindow() async {
        let source = Self.source()
        let vm = await loaded(source)
        await vm.send(.trendRangeChanged(.days90))?.value
        #expect(vm.state.range == .days90)
        #expect(source.fetched.last == Self.health90)
        #expect(vm.state.health.content.value?.days == 90)
        #expect(vm.send(.trendRangeChanged(.days90)) == nil)  // the same window fetches nothing
    }

    @Test func anAnswerForAWindowNoLongerShownIsDropped() async {
        let source = Self.source()
        let vm = await loaded(source)
        source.hold(Self.health90)
        let ninety = vm.send(.trendRangeChanged(.days90))
        await vm.send(.trendRangeChanged(.days30))?.value
        source.release(Self.health90)
        await ninety?.value
        #expect(vm.state.range == .days30)
        #expect(vm.state.health.content.value?.days == 30)
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
        let source = Self.source()
        source.answers[Self.todayKey] = .success(Data(line.utf8))
        let vm = await loaded(source, plan: [CoachPlanSnapshot(status: .ready, book: book)])
        vm.send(.lineItemTapped("ride"))
        #expect(vm.state.planItemTarget?.id == "ride")
        #expect(router.opened.isEmpty)
        vm.send(.destinationDismissed)
        #expect(vm.state.destination == nil)
    }

    @Test func planActivityTappedClosesTheSheetAndOpensTheActivity() async {
        let vm = await loaded()
        vm.send(.planActivityTapped("19015136492"))
        #expect(vm.state.destination == nil)
        #expect(router.opened == [.activity("19015136492")])
    }

    @Test func connectTappedShowsSettings() async {
        let vm = await loaded()
        vm.send(.connectTapped)
        #expect(tabs.shown == [.settings])
    }

    @Test func notConnectedShowsTheEmptyState() async {
        let off = Self.source()
        off.isConnected = false
        let vm = await loaded(off)
        #expect(vm.state.health.content == .empty)
        #expect(vm.state.today.content == .empty)
    }

    @Test func anAnchorFromTheLaunchIsInTheState() {
        #expect(makeViewModel(Self.source(), anchor: .end).state.anchor == .end)
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-open", "today-trends"]).todayAnchor == .trends)
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-open", "today-end"]).todayAnchor == .end)
        #expect(LaunchOptions(arguments: ["Lift", "-open", "today-trends"]).todayAnchor == nil)
    }
}
