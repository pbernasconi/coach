import Foundation
import KoboPatterns
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The weekly volume screen: the contract decodes, each Action, and `run()` (TEST-2). No sleeps (TEST-3).
@MainActor
@Suite struct LiftWeeklyTests {
    let body = Data(AppAPISamples.liftWeeklyContract.utf8)

    func loaded(_ source: FakeAppData) async -> LiftWeeklyViewModel {
        let vm = LiftWeeklyViewModel(data: source, now: SessionBuilder.now, calendar: SessionBuilder.calendar)
        await vm.run()
        return vm
    }

    @Test func theContractExampleDecodes() throws {
        let weekly = try JSONDecoder().decode(LiftWeekly.self, from: body)
        let weeks = try #require(weekly.weeks.value)
        #expect(weekly.unit == "lb")
        #expect(weeks.title == "Weekly volume")
        #expect(weeks.items.map(\.volumeText) == ["6,440 lb"])
        #expect(weeks.items.first?.relative == 0.249)
    }

    @Test func theDemoBodyDecodes() throws {
        let url = try #require(Bundle.main.url(forResource: "app-lift-weekly", withExtension: "json"))
        let weekly = try JSONDecoder().decode(LiftWeekly.self, from: Data(contentsOf: url))
        #expect(weekly.weeks.value?.items.isEmpty == false)
    }

    @Test func aFailedSectionDecodesAsFailed() throws {
        let weekly = try JSONDecoder().decode(LiftWeekly.self, from: Data(#"{"unit":"kg","weeks":{"ok":false}}"#.utf8))
        #expect(weekly.weeks == .failed)
    }

    @Test func runLoadsTheWeeks() async {
        let source = FakeAppData([.success(body)])
        let vm = await loaded(source)
        #expect(vm.state.weekly.content.value?.weeks.value?.items.count == 1)
        #expect(source.fetched == ["api/app/lift/weekly"])
        #expect(vm.state.weekly.freshness?.isOffline == false)
    }

    @Test func runIsEmptyWhenNotConnected() async {
        let source = FakeAppData()
        source.isConnected = false
        let vm = await loaded(source)
        #expect(vm.state.weekly.content == .empty)
    }

    @Test func refreshPulledKeepsTheWeeksOfflineWhenTheFetchFails() async {
        let source = FakeAppData([.success(body), .failure(.retryable(status: nil))])
        let vm = await loaded(source)
        await vm.send(.refreshPulled)?.value
        #expect(vm.state.weekly.content.value != nil)
        #expect(vm.state.weekly.freshness?.isOffline == true)
    }

    @Test func retryTappedLoadsAgainAfterAFailure() async {
        let source = FakeAppData([.failure(.retryable(status: nil)), .success(body)])
        let vm = await loaded(source)
        #expect(vm.state.weekly.content.phase == .failed)
        await vm.send(.retryTapped)?.value
        #expect(vm.state.weekly.content.value != nil)
    }

    @Test(arguments: [(0, 0.0, "No sessions"), (1, 18.0, "1 session · 18 sets"), (2, 1.0, "2 sessions · 1 set")])
    func countsText(sessions: Int, sets: Double, text: String) {
        #expect(LiftWeeklyText.counts(sessions: sessions, sets: sets) == text)
    }
}
