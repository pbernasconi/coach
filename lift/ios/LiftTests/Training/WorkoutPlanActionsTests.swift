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
}
