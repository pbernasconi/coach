import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct ExercisesViewModelTests {
    let squat = ExercisesViewModelTests.exercise(1, "Back squat", aliases: ["squat"], .barbell, [.quads, .glutes])
    let rdl = ExercisesViewModelTests.exercise(2, "Romanian deadlift", aliases: ["rdl"], .barbell, [.hamstrings])
    let crunch = ExercisesViewModelTests.exercise(3, "Crème crunch", aliases: [], .bodyweight, [])

    static func exercise(
        _ number: UInt64,
        _ name: String,
        aliases: [String],
        _ equipment: Equipment,
        _ primary: [Muscle]
    ) -> Exercise {
        Exercise(
            id: IDSequence.id(number),
            name: name,
            aliases: aliases,
            equipment: equipment,
            loadMode: .total,
            primary: primary,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    @Test func runLoadsTheLibraryWithoutArchivedExercises() async {
        var archived = ExercisesViewModelTests.exercise(4, "Old press", aliases: [], .machine, [.chest])
        archived.isArchived = true
        let vm = ExercisesViewModel(exercises: FakeExerciseRepository(emissions: [[], [squat, archived, rdl]]))

        await vm.run()

        #expect(vm.state.exercises == .loaded([ExerciseItem(exercise: squat), ExerciseItem(exercise: rdl)]))
        #expect(vm.state.visible.last?.detail == "Barbell · Hamstrings")
    }

    @Test func runShowsEmptyForAnEmptyLibrary() async {
        let vm = ExercisesViewModel(exercises: FakeExerciseRepository(emissions: [[]]))

        await vm.run()

        #expect(vm.state.exercises == .empty)
    }

    @Test(arguments: [
        ("RDL", ["Romanian deadlift"]),
        ("squat", ["Back squat"]),
        ("creme", ["Crème crunch"]),
        ("  ", ["Back squat", "Romanian deadlift", "Crème crunch"]),
        ("zercher", []),
    ])
    func queryChangedFiltersByNameAndAlias(query: String, expected: [String]) async {
        let vm = ExercisesViewModel(exercises: FakeExerciseRepository(emissions: [[squat, rdl, crunch]]))
        await vm.run()

        let task = vm.send(.queryChanged(query))

        #expect(task == nil)
        #expect(vm.state.query == query)
        #expect(vm.state.visible.map(\.name) == expected)
    }
}
