import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// Add workout, Change workout and Plan next week on the Week screen. One test per Action case (TEST-2); writes are
/// awaited through `send(...)?.value` (TEST-3).
@MainActor
@Suite struct WeekPlanningTests {
    let monday = Fixtures.monday
    let calendar = SessionBuilder.calendar
    let router = RecordingNavigator()
    let upperID = IDSequence.id(1, prefix: 0xD1)
    let lowerID = IDSequence.id(2, prefix: 0xD1)

    var days: DayCalendar { DayCalendar(calendar: calendar) }
    var thursday: LocalDay { monday.adding(days: 3) }

    /// A planned Thursday session made from Lower A.
    var planned: SessionDetail {
        var detail = SessionBuilder.session(id: 2, on: thursday, title: "Lower A", done: 0, planned: 3)
        detail.session.templateID = lowerID
        return detail
    }

    func template(_ id: UUID, _ name: String) -> DayTemplate {
        DayTemplate(
            id: id,
            name: name,
            exercises: [],
            position: 0,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    let units = InMemoryUnitSettings(.kg)

    func loaded(plans: FakeWorkoutPlanRepository = FakeWorkoutPlanRepository()) async -> WeekViewModel {
        let vm = WeekViewModel(
            sessions: FakeSessionRepository(emissions: [[planned]]),
            templates: FakeTemplateRepository(emissions: [[template(upperID, "Upper A"), template(lowerID, "Lower A")]]
            ),
            plans: plans,
            router: router,
            now: SessionBuilder.now,
            calendar: calendar,
            units: units
        )
        await vm.run()
        return vm
    }

    @Test func runReadsTheTemplatesAndOffersPlanningTheNextWeek() async {
        let vm = await loaded()

        #expect(vm.state.templates == [.init(id: upperID, name: "Upper A"), .init(id: lowerID, name: "Lower A")])
        #expect(vm.state.canPlanNextWeek)
    }

    @Test func addWorkoutTappedOpensThePickerForTheSelectedDay() async {
        let vm = await loaded()

        #expect(vm.send(.addWorkoutTapped(nil)) == nil)
        #expect(vm.state.destination == .add(WeekAddDay(id: monday, dayTitle: days.longTitle(of: monday))))
        vm.send(.addWorkoutTapped(thursday))
        #expect(vm.state.addTarget?.id == thursday)
    }

    @Test func aDayIsPlannedInTheUnitPreferredNow() async {
        let plans = FakeWorkoutPlanRepository()
        let vm = await loaded(plans: plans)
        units.unit = .lb  // changed in Settings while Week stays open

        await vm.send(.templatePicked(upperID, on: thursday))?.value

        #expect(plans.calls == [.createSession(upperID, on: thursday, unit: .lb)])
    }

    @Test func templatePickedPlansTheDayFromTheTemplate() async {
        let plans = FakeWorkoutPlanRepository()
        let vm = await loaded(plans: plans)
        vm.send(.addWorkoutTapped(thursday))

        await vm.send(.templatePicked(upperID, on: thursday))?.value

        #expect(vm.state.destination == nil)
        #expect(plans.calls == [.createSession(upperID, on: thursday, unit: .kg)])
        let message = String(localized: "Added Upper A on \(days.shortTitle(of: thursday))")
        #expect(vm.state.toast == WeekToast(id: 1, message: message, undo: nil))
    }

    @Test func blankWorkoutPickedMakesAnEmptySessionAndOpensIt() async {
        let repository = FakeSessionRepository(emissions: [[planned]])
        let vm = WeekViewModel(
            sessions: repository,
            templates: FakeTemplateRepository(),
            plans: FakeWorkoutPlanRepository(),
            router: router,
            now: SessionBuilder.now,
            calendar: calendar,
            units: InMemoryUnitSettings(.kg)
        )
        await vm.run()

        await vm.send(.blankWorkoutPicked(thursday))?.value

        #expect(repository.created.map(\.title) == [String(localized: "Workout")])
        #expect(repository.created.map(\.day) == [thursday])
        #expect(router.opened == [.workout(FakeSessionRepository.createdID)])
        #expect(vm.state.toast == nil)
    }

    @Test func changeWorkoutTappedOpensThePickerForThatSession() async {
        let vm = await loaded()

        vm.send(.changeWorkoutTapped(planned.id))

        #expect(vm.state.changeTarget?.id == planned.id)
        #expect(vm.state.changeTarget?.templateID == lowerID)
        #expect(vm.state.changeTarget?.canChangeWorkout == true)
    }

    @Test func changeTemplatePickedSwapsTheWorkoutAndOffersUndo() async {
        let plans = FakeWorkoutPlanRepository()
        let vm = await loaded(plans: plans)

        await vm.send(.changeTemplatePicked(planned.id, to: upperID))?.value

        #expect(plans.calls == [.changeTemplate(planned.id, to: upperID)])
        let undo = FakeWorkoutPlanRepository.changeUndo(planned.id)
        #expect(
            vm.state.toast == WeekToast(id: 1, message: String(localized: "Changed to Upper A"), undo: .template(undo))
        )
    }

    @Test func aStartedWorkoutKeepsItsExercises() async {
        let vm = await loaded(plans: FakeWorkoutPlanRepository(error: AppError(.conflict)))

        await vm.send(.changeTemplatePicked(planned.id, to: upperID))?.value

        #expect(vm.state.toast?.message == String(localized: "A started workout keeps its exercises"))
        #expect(vm.state.toast?.undo == nil)
    }

    @Test func planNextWeekTappedCopiesTheVisibleWeekAndOffersUndo() async {
        let plans = FakeWorkoutPlanRepository(plannedCount: 2)
        let vm = await loaded(plans: plans)

        await vm.send(.planNextWeekTapped)?.value

        #expect(plans.calls == [.planNextWeek(monday)])
        #expect(vm.state.toast?.message == String(localized: "Planned \(2) workouts for next week"))
        guard case .plan(let plan)? = vm.state.toast?.undo else {
            Issue.record("expected an undo")
            return
        }
        #expect(plan.sessionIDs.count == 2)
    }

    @Test func planningAFullNextWeekSaysSo() async {
        let vm = await loaded(plans: FakeWorkoutPlanRepository(plannedCount: 0))

        await vm.send(.planNextWeekTapped)?.value

        #expect(
            vm.state.toast
                == WeekToast(id: 1, message: String(localized: "Next week already has those days"), undo: nil)
        )
    }

    @Test func templateUndoTappedPutsTheOldWorkoutBack() async {
        let plans = FakeWorkoutPlanRepository()
        let vm = await loaded(plans: plans)
        let undo = FakeWorkoutPlanRepository.changeUndo(planned.id)

        await vm.send(.templateUndoTapped(undo))?.value

        #expect(plans.calls == [.undoChange(undo)])
        #expect(vm.state.toast == nil)
    }

    @Test func planUndoTappedRemovesThePlannedWeek() async {
        let plans = FakeWorkoutPlanRepository()
        let vm = await loaded(plans: plans)
        let undo = WeekPlanUndo(sessionIDs: [IDSequence.id(1, prefix: 0xC3)])

        await vm.send(.planUndoTapped(undo))?.value

        #expect(plans.calls == [.undoPlan(undo)])
        #expect(vm.state.toast == nil)
    }

    @Test func newTemplateTappedMakesOneAndOpensItsEditor() async {
        let templates = FakeTemplateRepository(emissions: [[]])
        let vm = WeekViewModel(
            sessions: FakeSessionRepository(emissions: [[]]),
            templates: templates,
            plans: FakeWorkoutPlanRepository(),
            router: router,
            now: SessionBuilder.now,
            calendar: calendar,
            units: InMemoryUnitSettings(.kg)
        )
        await vm.run()
        guard case .loaded(let days) = vm.state.sessions else {
            Issue.record("expected a loaded week")
            return
        }
        #expect(days.allSatisfy { $0.sessions.isEmpty })
        #expect(vm.state.templates.isEmpty)  // the first-run empty state points to New template

        await vm.send(.newTemplateTapped)?.value

        #expect(templates.calls == [.create("New template")])
        #expect(router.opened == [.template(FakeTemplateRepository.newID)])
    }
}
