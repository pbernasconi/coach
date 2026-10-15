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
        let vm = ExercisesViewModel(
            exercises: FakeExerciseRepository(emissions: [[], [squat, archived, rdl]]),
            catalog: FakeExerciseCatalog(),
            router: RecordingNavigator()
        )

        await vm.run()

        #expect(vm.state.exercises == .loaded([ExerciseItem(exercise: squat), ExerciseItem(exercise: rdl)]))
        #expect(vm.state.visible.last?.detail == "Barbell · Hamstrings")
    }

    @Test func runShowsEmptyForAnEmptyLibrary() async {
        let vm = ExercisesViewModel(
            exercises: FakeExerciseRepository(emissions: [[]]),
            catalog: FakeExerciseCatalog(),
            router: RecordingNavigator()
        )

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
        let vm = ExercisesViewModel(
            exercises: FakeExerciseRepository(emissions: [[squat, rdl, crunch]]),
            catalog: FakeExerciseCatalog(),
            router: RecordingNavigator()
        )
        await vm.run()

        let task = vm.send(.queryChanged(query))

        #expect(task == nil)
        #expect(vm.state.query == query)
        #expect(vm.state.visible.map(\.name) == expected)
    }

    @Test func exerciseTappedOpensTheDetail() {
        let router = RecordingNavigator()
        let vm = ExercisesViewModel(exercises: FakeExerciseRepository(emissions: []), catalog: FakeExerciseCatalog(), router: router)

        let task = vm.send(.exerciseTapped(rdl.id))

        #expect(task == nil)
        #expect(router.opened == [.exercise(rdl.id)])
    }

    @Test func thumbnailNeededLoadsTheStillOnce() async {
        let still = MediaImage.loaded(FakeExerciseCatalog.imageData)
        let catalog = FakeExerciseCatalog(entries: [FakeExerciseCatalog.entry("0043", "Squat")], images: ["0043": still])
        let vm = ExercisesViewModel(exercises: FakeExerciseRepository(emissions: []), catalog: catalog, router: RecordingNavigator())

        let task = vm.send(.thumbnailNeeded(catalogID: "0043"))
        #expect(vm.state.thumbnails["0043"] == .loading)
        #expect(vm.send(.thumbnailNeeded(catalogID: "0043")) == nil)
        await task?.value

        #expect(vm.state.thumbnails["0043"] == still)
        #expect(catalog.imageRequests == [.init(kind: .still, catalogID: "0043")])
        await vm.send(.thumbnailNeeded(catalogID: "9999"))?.value
        #expect(vm.state.thumbnails["9999"] == .failed)
    }

    @Test func allExercisesTappedOpensTheCatalog() {
        let router = RecordingNavigator()
        let vm = ExercisesViewModel(exercises: FakeExerciseRepository(emissions: []), catalog: FakeExerciseCatalog(), router: router)

        #expect(vm.send(.allExercisesTapped) == nil)
        #expect(router.opened == [.catalog])
    }

    @Test func rowsCarryTheirCatalogID() {
        #expect(ExerciseItem(exercise: ExerciseLibrary.seed[0]).catalogID == "0043")
        #expect(ExerciseItem(exercise: crunch).catalogID == nil)
    }
}
