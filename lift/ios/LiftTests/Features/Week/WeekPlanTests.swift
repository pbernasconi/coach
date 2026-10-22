import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The coach plan on the Week screen: the merge of plan items with local Lift sessions, and the plan Actions.
/// `SessionBuilder.now` is Monday 2026-03-02, the first day of its week.
@MainActor
@Suite struct WeekPlanTests {
    let monday = Fixtures.monday
    let calendar = SessionBuilder.calendar
    let router = RecordingNavigator()

    /// Friday's planned Upper A (id 2).
    var friday: SessionDetail {
        SessionBuilder.session(id: 2, on: monday.adding(days: 4), title: "Upper A", done: 0, planned: 3)
    }

    func lowerCaseID(_ detail: SessionDetail) -> String { detail.id.uuidString.lowercased() }

    func snapshot(_ items: [(LocalDay, String)], status: CoachPlanSnapshot.Status = .ready) throws
        -> CoachPlanSnapshot
    {
        CoachPlanSnapshot(status: status, book: CoachPlanBook([try CoachPlanSamples.plan(start: monday, items: items)]))
    }

    func loaded(_ sessions: [SessionDetail], plan: [CoachPlanSnapshot]) async -> (WeekViewModel, FakeCoachPlan) {
        let coachPlan = FakeCoachPlan(plan)
        let vm = WeekViewModel(
            sessions: FakeSessionRepository(emissions: [sessions]),
            templates: FakeTemplateRepository(),
            plans: FakeWorkoutPlanRepository(),
            router: router,
            now: SessionBuilder.now,
            calendar: calendar,
            units: InMemoryUnitSettings(.kg),
            coachPlan: coachPlan
        )
        await vm.run()
        return (vm, coachPlan)
    }

    func entries(_ vm: WeekViewModel) -> [[WeekEntry]] {
        guard case .loaded(let days) = vm.state.sessions else { return [] }
        return days.map(\.entries)
    }

    func ids(_ vm: WeekViewModel) -> [[String]] {
        entries(vm).map { $0.map(\.id) }
    }

    // MARK: - Merge

    @Test func aLinkedSessionShowsOnThePlansDayInPlaceOfItsItem() async throws {
        let wednesday = monday.adding(days: 2)
        let link = CoachPlanSamples.item("lift", on: wednesday, sport: "strength", session: lowerCaseID(friday))
        let ride = CoachPlanSamples.item("ride", on: wednesday)
        let (vm, _) = await loaded([friday], plan: [try snapshot([(wednesday, link), (wednesday, ride)])])

        let session = SessionSummary(detail: friday)
        let week = entries(vm)
        #expect(week[2].first == .session(session))
        #expect(week[2].map(\.id) == ["session-\(friday.id.uuidString)", "plan-ride"])
        #expect(week[4].isEmpty)  // the plan's day wins over the session's own day
    }

    @Test func aSessionMovedOnThisPhoneAfterTheFetchShowsOnItsNewDay() async throws {
        let link = CoachPlanSamples.item(
            "lift",
            on: monday.adding(days: 2),
            sport: "strength",
            session: lowerCaseID(friday)
        )
        let fetched = try #require(CoachPlanDates.date(fromISO: "2026-03-02T13:05:00Z"))
        var moved = friday
        moved.session.dayMovedAt = fetched.addingTimeInterval(60)  // after the plan was fetched: the move wins
        var older = friday
        older.session.dayMovedAt = fetched.addingTimeInterval(-60)  // before: the server already had it

        let (afterFetch, _) = await loaded([moved], plan: [try snapshot([(monday.adding(days: 2), link)])])
        #expect(entries(afterFetch)[2].isEmpty)
        #expect(entries(afterFetch)[4] == [.session(SessionSummary(detail: moved))])

        let (beforeFetch, _) = await loaded([older], plan: [try snapshot([(monday.adding(days: 2), link)])])
        #expect(entries(beforeFetch)[2] == [.session(SessionSummary(detail: older))])
        #expect(entries(beforeFetch)[4].isEmpty)
    }

    @Test func aLinkMatchesTheSessionIdInAnyCase() async throws {
        let upper = CoachPlanSamples.item("lift", on: monday, sport: "strength", session: friday.id.uuidString)
        let lower = CoachPlanSamples.item("lift2", on: monday, sport: "strength", session: lowerCaseID(friday))
        let (vm, _) = await loaded([friday], plan: [try snapshot([(monday, upper), (monday, lower)])])

        #expect(entries(vm)[0] == [.session(SessionSummary(detail: friday))])  // shown once
    }

    @Test func anUnlinkedSessionShowsOnItsOwnDayAfterTheItems() async throws {
        let ride = CoachPlanSamples.item("ride", on: monday.adding(days: 4))
        let (vm, _) = await loaded([friday], plan: [try snapshot([(monday.adding(days: 4), ride)])])

        #expect(ids(vm)[4] == ["plan-ride", "session-\(friday.id.uuidString)"])
    }

    @Test func anItemWhoseSessionIsNotOnThisPhoneShowsAsAnItem() async throws {
        let missing = "00000000-0000-4000-8000-0000000000ff"
        let lift = CoachPlanSamples.item("lift", on: monday, sport: "strength", session: missing)
        let rest = CoachPlanSamples.item("rest", on: monday.adding(days: 1), sport: "rest")
        let (vm, _) = await loaded([], plan: [try snapshot([(monday, lift), (monday.adding(days: 1), rest)])])

        guard case .plan(let item) = entries(vm)[0].first, case .plan(let restItem) = entries(vm)[1].first else {
            Issue.record("expected plan items")
            return
        }
        #expect(item.sport == .strength && item.title == "lift title" && item.stateLabel == "Planned")
        #expect(restItem.sport == .rest)
        #expect(item.steps == [CoachStep(label: "Warm up", detail: "10:00")])
        // A rest item marks nothing in the strip; the lift does.
        let marked = vm.state.strip?.days.map(\.date) ?? []
        #expect(marked == [monday.startDate(in: calendar)].compactMap(\.self))
    }

    @Test func syncOffShowsOnlySessionsAsBefore() async {
        let (vm, _) = await loaded([friday], plan: [.off])

        #expect(vm.state.plan == nil)
        #expect(entries(vm)[4] == [.session(SessionSummary(detail: friday))])
        #expect(entries(vm).enumerated().allSatisfy { $0.offset == 4 || $0.element.isEmpty })
    }

    // MARK: - Header

    @Test func theHeaderShowsTheWeeksTitleTotalsAndFreshness() async throws {
        let fetchedAt = try #require(CoachPlanDates.date(fromISO: "2026-03-02T13:05:00.000Z"))
        let (vm, _) = await loaded([], plan: [try snapshot([])])
        #expect(
            vm.state.plan
                == WeekPlanHeader(
                    title: "Build week 3",
                    totals: "0/9 done · 0:00 of 9:00",
                    freshness: "Updated \(DayCalendar(calendar: calendar).timeTitle(of: fetchedAt))",
                    isOffline: false
                )
        )

        let (offline, _) = await loaded([], plan: [try snapshot([], status: .offline)])
        #expect(offline.state.plan?.isOffline == true)
        #expect(offline.state.plan?.freshness?.hasPrefix("Offline") == true)
    }

    // MARK: - Actions

    @Test func runShowsThisWeeksPlan() async {
        let (_, plan) = await loaded([], plan: [.off])
        #expect(plan.shownWeeks == [monday])
    }

    @Test func weekChangedShowsThatWeeksPlan() async {
        let (vm, plan) = await loaded([], plan: [.off])
        await vm.send(.weekChanged(1))?.value
        #expect(vm.state.weekOffset == 1)
        #expect(plan.shownWeeks.last == monday.adding(days: 7))
    }

    @Test func planItemTappedOnAnUnplannedActivityOpensIt() async throws {
        let ride = CoachPlanSamples.item("activity-8001", on: monday.adding(days: 1), state: "done", unplanned: true)
        let (vm, _) = await loaded([], plan: [try snapshot([(monday.adding(days: 1), ride)])])

        vm.send(.planItemTapped("activity-8001"))

        #expect(vm.state.destination == nil)
        #expect(router.opened == [.activity("8001")])
    }

    @Test func planItemTappedOpensTheDetailSheet() async throws {
        let ride = CoachPlanSamples.item("ride", on: monday.adding(days: 1))
        let (vm, _) = await loaded([], plan: [try snapshot([(monday.adding(days: 1), ride)])])

        vm.send(.planItemTapped("ride"))
        #expect(vm.state.planItemTarget?.id == "ride")
        #expect(vm.state.planItemTarget?.why == "Because")
        #expect(vm.state.planItemTarget?.doneText == "62 min / 60 min")
        #expect(
            vm.state.planItemTarget?.dayTitle == DayCalendar(calendar: calendar).longTitle(of: monday.adding(days: 1))
        )
        vm.send(.destinationDismissed)
        #expect(vm.state.destination == nil)
        vm.send(.planItemTapped("gone"))
        #expect(vm.state.destination == nil)
    }

    @Test func aFinishedSessionOpensTheCoachsSessionPageWhenTheCoachIsOn() async throws {
        let done = SessionBuilder.session(id: 1, on: monday, done: 3, planned: 0)
        let (vm, _) = await loaded([done, friday], plan: [try snapshot([])])
        vm.send(.sessionTapped(done.id))
        vm.send(.sessionTapped(friday.id))
        #expect(router.opened == [.liftSession(done.id.uuidString.lowercased()), .workout(friday.id)])

        let (off, _) = await loaded([done], plan: [.off])
        off.send(.sessionTapped(done.id))
        #expect(router.opened.last == .workout(done.id))
    }

    @Test func anItemNamingASessionThisPhoneLacksOpensTheCoachsSessionPage() async throws {
        let missing = "00000000-0000-4000-8000-0000000000ff"
        let lift = CoachPlanSamples.item("lift", on: monday, sport: "strength", session: missing)
        let (vm, _) = await loaded([], plan: [try snapshot([(monday, lift)])])
        vm.send(.planItemTapped("lift"))
        #expect(router.opened == [.liftSession(missing)])
        #expect(vm.state.destination == nil)
    }

    @Test func planActivityTappedOpensTheMatchedActivity() async throws {
        let ride = CoachPlanSamples.item("ride", on: monday.adding(days: 1))
        let (vm, _) = await loaded([], plan: [try snapshot([(monday.adding(days: 1), ride)])])
        vm.send(.planItemTapped("ride"))
        #expect(vm.state.planItemTarget?.doneActivityId == "8001")
        vm.send(.planActivityTapped("8001"))
        #expect(vm.state.destination == nil)
        #expect(router.opened == [.activity("8001")])
    }
}
