import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// Long-press and drop on the Week screen: a plan item moves on the coach, a Lift session here, and Undo puts either
/// back. Done workouts never drag. `SessionBuilder.now` is Monday 2026-03-02.
@MainActor
@Suite struct WeekDragTests {
    let monday = Fixtures.monday
    let calendar = SessionBuilder.calendar
    var days: DayCalendar { DayCalendar(calendar: calendar) }
    var friday: LocalDay { monday.adding(days: 4) }
    var planned: SessionDetail { SessionBuilder.session(id: 2, on: friday, title: "Upper A", done: 0, planned: 3) }

    func loaded(_ items: [(LocalDay, String)] = []) async throws
        -> (WeekViewModel, FakeCoachPlan, FakeSessionRepository)
    {
        let book = CoachPlanBook([try CoachPlanSamples.plan(start: monday, items: items)])
        let coachPlan = FakeCoachPlan([CoachPlanSnapshot(status: .ready, book: book)])
        let repository = FakeSessionRepository(emissions: [[planned]])
        let vm = WeekViewModel(
            sessions: repository,
            templates: FakeTemplateRepository(),
            plans: FakeWorkoutPlanRepository(),
            router: RecordingNavigator(),
            now: SessionBuilder.now,
            calendar: calendar,
            units: InMemoryUnitSettings(.kg),
            coachPlan: coachPlan
        )
        await vm.run()
        return (vm, coachPlan, repository)
    }

    @Test func aDropTravelsAsTextAndBack() {
        let plan = WeekDrag.plan(id: "ride-1", from: friday)
        let session = WeekDrag.session(planned.id, from: friday)
        #expect(WeekDrag(text: plan.text) == plan)
        #expect(WeekDrag(text: session.text) == session)
        #expect(WeekDrag(text: "nope") == nil)
        #expect(WeekDrag(text: "session|2026-03-06|not-a-uuid") == nil)
    }

    @Test func onlyAWorkoutNotDoneYetDrags() throws {
        func item(_ json: String) throws -> WeekEntry {
            let plan = try CoachPlanSamples.plan(start: monday, items: [(monday, json)])
            return .plan(WeekPlanItem(plan.weeks[0].days[0].items[0], dayTitle: ""))
        }
        #expect(WeekDrag(try item(CoachPlanSamples.item("ride", on: monday)), on: monday) != nil)
        #expect(WeekDrag(try item(CoachPlanSamples.item("ride", on: monday, state: "missed")), on: monday) != nil)
        #expect(WeekDrag(try item(CoachPlanSamples.item("ride", on: monday, state: "done")), on: monday) == nil)
        #expect(WeekDrag(try item(CoachPlanSamples.item("rest", on: monday, sport: "rest")), on: monday) == nil)
        let unplanned = CoachPlanSamples.item("activity-1", on: monday, state: "done", unplanned: true)
        #expect(WeekDrag(try item(unplanned), on: monday) == nil)
        let done = SessionBuilder.session(id: 1, on: monday, done: 3, planned: 0)
        #expect(WeekDrag(.session(SessionSummary(detail: done)), on: monday) == nil)
    }

    @Test func aPlanItemDroppedOnAnotherDayMovesOnTheCoachAndOffersUndo() async throws {
        let tuesday = monday.adding(days: 1)
        let (vm, coachPlan, _) = try await loaded([(tuesday, CoachPlanSamples.item("ride", on: tuesday))])

        await vm.send(.rowDropped(.plan(id: "ride", from: tuesday), on: friday))?.value

        #expect(coachPlan.edits == [.move(id: "ride", to: friday)])
        let message = String(localized: "Moved to \(days.shortTitle(of: friday))")
        #expect(vm.state.toast == WeekToast(id: 1, message: message, undo: .planMove(id: "ride", from: tuesday)))

        await vm.send(.planMoveUndoTapped("ride", to: tuesday))?.value
        #expect(coachPlan.edits == [.move(id: "ride", to: friday), .move(id: "ride", to: tuesday)])
    }

    @Test func aRefusedPlanMoveSaysSo() async throws {
        let (vm, coachPlan, _) = try await loaded()
        coachPlan.editError = .rejected(status: 409)

        await vm.send(.rowDropped(.plan(id: "ride", from: monday), on: friday))?.value

        #expect(vm.state.toast?.message == String(localized: "The workout could not be changed"))
        #expect(vm.state.toast?.undo == nil)
    }

    @Test func aLiftSessionDroppedOnAnotherDayIsRescheduledHere() async throws {
        let (vm, coachPlan, repository) = try await loaded()
        let wednesday = monday.adding(days: 2)

        await vm.send(.rowDropped(.session(planned.id, from: friday), on: wednesday))?.value

        #expect(repository.rescheduled == [.init(sessionID: planned.id, action: .move(to: wednesday))])
        #expect(coachPlan.edits.isEmpty)
        let undo = RescheduleUndo(sessionID: planned.id, previousDay: friday)
        #expect(vm.state.toast?.undo == .reschedule(undo))
    }
}
