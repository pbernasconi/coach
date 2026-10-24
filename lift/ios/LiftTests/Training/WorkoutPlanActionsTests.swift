import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// "Start workout" and "Mark done" on a planned strength workout (APP-API.md, "Workout status", "Workout Lift
/// session").
@MainActor
@Suite struct WorkoutPlanActionsTests {
    let router = RecordingNavigator()
    let plans = FakeWorkoutPlanRepository()
    let coachPlan = FakeCoachPlan([])
    static let ref = WorkoutDetail.planRef("p1")

    /// A strength workout still to do, with one exercise the library knows.
    static func body(liftSessionId: String? = nil) -> Data {
        let session = liftSessionId.map { "\"\($0)\"" } ?? "null"
        return Data(
            """
            { "ref": "plan-p1", "state": "planned", "title": "Home calf raises", "activity": null, "feedback": null,
              "plan": { "id": "p1", "date": "2026-03-05", "title": "Home calf raises", "sport": "strength",
                "subtitle": "Strength · Thursday, March 5", "state": "planned", "stateLabel": "Planned",
                "compliance": null, "adapted": false, "hero": [], "workout": null, "intensity": null,
                "notes": "At home.", "liftSessionId": \(session), "done": null,
                "exercises": [{ "name": "\(Fixtures.squat.name)", "sets": 3, "reps": 15, "repsMax": null, "note": "Slow" }] } }
            """.utf8
        )
    }

    func loaded(_ body: Data = body()) async -> (ActivityDetailViewModel, RoutedAppData) {
        let data = RoutedAppData([WorkoutDetail.path(Self.ref): .success(body)])
        let starter = PlannedSessionStarter(
            exercises: FakeExerciseRepository(emissions: [[Fixtures.squat]]),
            plans: plans,
            catalog: FakeExerciseCatalog(),
            units: InMemoryUnitSettings(.kg),
            data: data
        )
        let vm = ActivityDetailViewModel(
            ref: Self.ref,
            seed: nil,
            data: data,
            starter: starter,
            coachPlan: coachPlan,
            router: router,
            tabs: RecordingTabs(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, data)
    }

    @Test func startWorkoutMakesTheCoachsSessionLinksItAndOpensIt() async {
        let (vm, data) = await loaded()
        await vm.send(.startWorkoutTapped)?.value
        #expect(
            plans.calls == [
                .createCoachSession(
                    "Home calf raises",
                    on: LocalDay(year: 2026, month: 3, day: 5),
                    exercises: [CoachExercise(exercise: Fixtures.squat, sets: 3, repRange: 15...15, note: "Slow")]
                )
            ]
        )
        #expect(data.puts == [AppPlannedWorkout.liftSessionPath("p1")])
        #expect(router.opened == [.workout(FakeWorkoutPlanRepository.sessionID)])
        #expect(vm.state.planWrite == .idle)
    }

    @Test func startWorkoutDoesNothingOnceASessionIsLinked() async {
        let (vm, _) = await loaded(Self.body(liftSessionId: "de300000-0000-4000-8000-000000000100"))
        #expect(vm.send(.startWorkoutTapped) == nil)
        #expect(plans.calls.isEmpty)
    }

    @Test func doneToggledSavesTheStatusAndReadsTheWeekAgain() async {
        let (vm, data) = await loaded()
        await vm.send(.doneToggled(true))?.value
        #expect(data.puts == [AppPlannedWorkout.statusPath("p1")])
        #expect(coachPlan.refreshCount == 1)
        #expect(vm.state.planWrite == .idle)
    }

    @Test func theDayComesFromTheWorkout() {
        #expect(PlannedSessionStarter.day(fromISO: "2026-10-22") == LocalDay(year: 2026, month: 10, day: 22))
        #expect(PlannedSessionStarter.day(fromISO: "nope") == nil)
    }

    // MARK: - Move and delete (APP-API.md, "Move a workout", "Delete a workout")

    @Test func moveTappedOpensTheDayPickerOnTheWorkoutsDay() async {
        let (vm, _) = await loaded()
        vm.send(.moveTapped)
        let days = DayCalendar(calendar: SessionBuilder.calendar)
        let thursday = LocalDay(year: 2026, month: 3, day: 5)
        #expect(vm.state.moveDay?.id == "p1")
        #expect(vm.state.moveDay?.current == days.date(of: thursday))
        #expect(vm.state.moveDay?.first == days.date(of: Fixtures.monday.adding(days: -28)))
        #expect(vm.state.moveDay?.last == days.date(of: Fixtures.monday.adding(days: 34)))
    }

    @Test func moveDayPickedMovesTheWorkoutAndReadsThePageAgain() async {
        let (vm, data) = await loaded()
        vm.send(.moveTapped)
        let saturday = LocalDay(year: 2026, month: 3, day: 7)
        let date = DayCalendar(calendar: SessionBuilder.calendar).date(of: saturday) ?? .distantPast

        await vm.send(.moveDayPicked(date))?.value

        #expect(vm.state.destination == nil)
        #expect(coachPlan.edits == [.move(id: "p1", to: saturday)])
        #expect(data.fetched.count >= 2)  // the page read again on its new day
        #expect(vm.state.planWrite == .idle)
    }

    @Test func moveDayPickedOnTheSameDayDoesNothing() async {
        let (vm, _) = await loaded()
        let thursday = LocalDay(year: 2026, month: 3, day: 5)
        let date = DayCalendar(calendar: SessionBuilder.calendar).date(of: thursday) ?? .distantPast
        #expect(vm.send(.moveDayPicked(date)) == nil)
        #expect(coachPlan.edits.isEmpty)
    }

    @Test func deleteAsksFirstThenDeletesAndCloses() async {
        let (vm, _) = await loaded()
        vm.send(.deleteTapped)
        #expect(vm.state.isConfirmingDelete)
        #expect(coachPlan.edits.isEmpty)

        await vm.send(.deleteConfirmed)?.value

        #expect(coachPlan.edits == [.remove(id: "p1")])
        #expect(router.backCount == 1)
        #expect(vm.state.destination == nil)
    }

    @Test func aRefusedDeleteSaysWhyAndStays() async {
        let (vm, _) = await loaded()
        coachPlan.editError = .rejected(status: 409)
        vm.send(.deleteTapped)

        await vm.send(.deleteConfirmed)?.value

        #expect(router.backCount == 0)
        #expect(vm.state.planWrite == .failed(String(localized: "A done workout stays as it is.")))
    }

    @Test func aDoneWorkoutCannotMoveOrGo() async {
        let done = String(decoding: Self.body(), as: UTF8.self).replacingOccurrences(of: "planned", with: "done")
        let (vm, _) = await loaded(Data(done.utf8))
        #expect(!vm.state.canChangePlan)
        vm.send(.moveTapped)
        vm.send(.deleteTapped)
        #expect(vm.state.destination == nil)
    }
}
