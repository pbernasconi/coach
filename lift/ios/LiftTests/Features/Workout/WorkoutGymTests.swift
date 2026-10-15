import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The Workout screen on the person's own plates (Settings → Plates and bars): plates per side, the warm-up ramp,
/// the next target and the weight step. A made-up gym: a 15 kg bar, no 25s and no 1.25s (TEST-8).
@MainActor
@Suite struct WorkoutGymTests {
    static let gym: GymSetup = {
        var gym = GymSetup.standard
        gym.kg.bar = 15
        for index in gym.kg.plates.indices where [25, 1.25].contains(gym.kg.plates[index].size) {
            gym.kg.plates[index].isAvailable = false
        }
        return gym
    }()

    @Test func platesAndWarmUpUseTheGymsBarAndPlates() async {
        let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)

        let (vm, _) = await WorkoutRunTests().run([planned], gym: Self.gym)

        let exercise = WorkoutRunTests().exercise(vm)
        #expect(exercise?.plates == "Per side: 20 + 20 + 2.5 · 15 kg bar")
        #expect(exercise?.warmUp == "Warm-up: 15×10 · 50×5 · 70×3 · 85×1 kg")
    }

    @Test func collarsShowWithTheBarAndCountInTheLoad() async {
        var gym = Self.gym
        gym.kg.collar = 2.5
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 1)
        detail.items[0].sets[0].target = SetTarget(reps: 5, weight: .kg(60))

        let (vm, _) = await WorkoutRunTests().run([detail], gym: gym)

        #expect(WorkoutRunTests().exercise(vm)?.plates == "Per side: 20 · 15 kg bar + collars")
    }

    @Test func theNextTargetIsAStepThePlatesCanMake() async {
        var done = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 3, planned: 0)
        for index in done.items[0].sets.indices {
            done.items[0].sets[index].actualReps = 5
            done.items[0].sets[index].actualWeight = .kg(100)
        }

        let (vm, _) = await WorkoutRunTests().run([done], gym: Self.gym)

        #expect(WorkoutRunTests().exercise(vm)?.progression == "Next time: 5 @ 105 kg")
    }

    @Test func theEditorStepsByTheLightestPair() async {
        let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
        let (vm, _) = await WorkoutRunTests().run([planned], gym: Self.gym)

        vm.send(.setValuesTapped(planned.items[0].sets[0].id))

        #expect(vm.state.editor?.step == 5)
    }

    @Test func nonBarbellLiftsKeepTheirStep() async {
        var planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
        planned.items[0].exercise.equipment = .dumbbell
        let (vm, _) = await WorkoutRunTests().run([planned], gym: Self.gym)

        vm.send(.setValuesTapped(planned.items[0].sets[0].id))

        #expect(vm.state.editor?.step == 2.5)
    }
}
