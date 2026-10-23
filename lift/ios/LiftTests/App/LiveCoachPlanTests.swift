import Foundation
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The live Week plan: the cache at launch, fetches and what they keep, offline and sync-off states, and the refresh
/// after each sync run. `SessionBuilder.now` is Monday 2026-03-02.
@MainActor
@Suite struct LiveCoachPlanTests {
    let monday = Fixtures.monday
    var nextMonday: LocalDay { monday.adding(days: 7) }

    func body(_ start: LocalDay, generatedAt: String = "2026-03-02T13:05:00.000Z") -> Data {
        CoachPlanSamples.body(
            start: start,
            items: [(start, CoachPlanSamples.item("ride-\(start.day)", on: start))],
            generatedAt: generatedAt
        )
    }

    func makePlan(client: FakeCoachPlanClient, cache: InMemoryCoachPlanCache, sync: FakeSyncing = FakeSyncing())
        -> LiveCoachPlan
    {
        LiveCoachPlan(
            client: client,
            cache: cache,
            sync: sync,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    /// The first snapshot the stream yields.
    func first(_ plan: LiveCoachPlan) async -> CoachPlanSnapshot? {
        for await snapshot in plan.snapshots() { return snapshot }
        return nil
    }

    @Test func launchShowsTheKeptPlanBeforeAnyFetch() async {
        let client = FakeCoachPlanClient()
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache([monday: body(monday)]))

        let snapshot = await first(plan)
        #expect(snapshot?.status == .ready)
        #expect(snapshot?.book.weeks[monday]?.title == "Build week 3")
        #expect(client.requests.isEmpty)
    }

    @Test func showFetchesAWeekThatIsNotKeptAndKeepsTheBody() async {
        let client = FakeCoachPlanClient(responses: [monday: body(monday)])
        let cache = InMemoryCoachPlanCache()
        let plan = makePlan(client: client, cache: cache)

        await plan.show(weekStart: monday)
        #expect(client.requests == [monday])
        #expect(cache.stored[monday] == body(monday))
        #expect(await first(plan)?.book.weeks[monday] != nil)
    }

    @Test func showSkipsTheFetchWhenBothWeeksAreKept() async {
        let client = FakeCoachPlanClient()
        let cache = InMemoryCoachPlanCache([monday: body(monday), nextMonday: body(nextMonday)])
        let plan = makePlan(client: client, cache: cache)

        await plan.show(weekStart: monday)
        #expect(client.requests.isEmpty)
    }

    @Test func showFetchesAgainWhenTheKeptWeeksAreOld() async {
        let client = FakeCoachPlanClient(responses: [monday: body(monday)])
        let old = "2026-02-20T09:00:00.000Z"
        let cache = InMemoryCoachPlanCache([
            monday: body(monday, generatedAt: old), nextMonday: body(nextMonday, generatedAt: old),
        ])
        let plan = makePlan(client: client, cache: cache)

        await plan.show(weekStart: monday)
        #expect(client.requests == [monday])
    }

    @Test func refreshFetchesTheShownWeekEvenWhenKept() async {
        let client = FakeCoachPlanClient(responses: [nextMonday: body(nextMonday)])
        let later = nextMonday.adding(days: 7)
        let cache = InMemoryCoachPlanCache([nextMonday: body(nextMonday), later: body(later)])
        let plan = makePlan(client: client, cache: cache)

        await plan.show(weekStart: nextMonday)
        await plan.refresh()
        #expect(client.requests == [nextMonday])
    }

    @Test func refreshSyncsThisIPhoneFirst() async {
        let sync = FakeSyncing()
        let client = FakeCoachPlanClient(responses: [monday: body(monday)])
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache(), sync: sync)
        await plan.refresh()
        #expect(sync.syncNowCount == (sync.isConfigured ? 1 : 0))
        #expect(client.requests.contains(monday))
    }

    @Test func aFailedFetchKeepsTheKeptPlanAndSaysOffline() async {
        let client = FakeCoachPlanClient(error: .retryable(status: nil))
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache([monday: body(monday)]))

        await plan.refresh()
        let snapshot = await first(plan)
        #expect(snapshot?.status == .offline)
        #expect(snapshot?.book.weeks[monday] != nil)
    }

    @Test func noTokenTurnsThePlanOffAndANewTokenTurnsItBackOn() async {
        let client = FakeCoachPlanClient(responses: [monday: body(monday)], error: .missingToken)
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache())

        await plan.refresh()
        #expect(await first(plan)?.status == .off)
        await plan.show(weekStart: monday)
        #expect(client.requests.count == 1)  // off: changing weeks does not fetch

        client.fail(with: nil)
        await plan.refresh()
        #expect(await first(plan)?.status == .ready)
    }

    @Test func aRefusedTokenTurnsThePlanOff() async {
        let client = FakeCoachPlanClient(error: .unauthorized)
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache([monday: body(monday)]))
        await plan.refresh()
        #expect(await first(plan)?.status == .off)
    }

    @Test func aNewerResponseReplacesTheKeptWeek() async {
        let newer = CoachPlanSamples.body(start: monday, items: [], generatedAt: "2026-03-02T14:00:00.000Z")
        let client = FakeCoachPlanClient(responses: [monday: newer])
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache([monday: body(monday)]))

        await plan.refresh()
        let book = await first(plan)?.book
        #expect(book?.weeks[monday]?.days.allSatisfy(\.items.isEmpty) == true)
        #expect(book?.updatedAt == CoachPlanDates.date(fromISO: "2026-03-02T14:00:00Z"))
    }

    @Test func watchSyncRefreshesAfterEachFinishedSyncRun() async {
        let sync = FakeSyncing()
        sync.statuses = [
            SyncStatus(phase: .syncing, lastSyncedAt: nil),
            SyncStatus(phase: .idle, lastSyncedAt: ManualNow.start),
            SyncStatus(phase: .syncing, lastSyncedAt: ManualNow.start),
            SyncStatus(phase: .failed(.offline), lastSyncedAt: ManualNow.start),
        ]
        let client = FakeCoachPlanClient(responses: [monday: body(monday)])
        let plan = makePlan(client: client, cache: InMemoryCoachPlanCache(), sync: sync)

        await plan.watchSync()
        #expect(client.requests == [monday, monday])  // this week until the Week screen shows another
        #expect(sync.syncNowCount == 0)  // a sync here would start the next status, and the next sync, without end
    }
}
