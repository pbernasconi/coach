import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct ExercisePickerViewModelTests {
    let router = RecordingNavigator()
    let templateID = IDSequence.id(1, prefix: 0xD1)
    let sessionID = IDSequence.id(1, prefix: 0xA0)
    let catalog = FakeExerciseCatalog(
        entries: [
            FakeExerciseCatalog.entry("0043", "Barbell full squat"),
            FakeExerciseCatalog.entry("0025", "Barbell bench press", bodyPart: "chest", target: "pectorals"),
        ],
        images: ["0043": .loaded(FakeExerciseCatalog.imageData)]
    )

    func loaded(
        _ target: ExercisePickerTarget,
        templates: FakeTemplateRepository = FakeTemplateRepository(),
        plans: FakeWorkoutPlanRepository = FakeWorkoutPlanRepository(),
        exercises: RecordingCatalogExerciseRepository? = nil
    ) async -> ExercisePickerViewModel {
        let vm = ExercisePickerViewModel(
            target: target,
            exercises: exercises
                ?? RecordingCatalogExerciseRepository(emissions: [[Fixtures.squat, Fixtures.dumbbellBench]]),
            catalog: catalog,
            templates: templates,
            plans: plans,
            router: router
        )
        await vm.run()
        return vm
    }

    @Test func runListsTheLibraryAndTheCatalog() async {
        let vm = await loaded(.template(templateID))

        #expect(
            vm.state.library
                == .loaded([ExerciseItem(exercise: Fixtures.squat), ExerciseItem(exercise: Fixtures.dumbbellBench)])
        )
        guard case .loaded(let rows) = vm.state.catalog else {
            Issue.record("expected the catalog")
            return
        }
        #expect(rows.map(\.id).sorted() == ["0025", "0043"])
    }

    @Test func queryChangedFiltersBothLists() async {
        let vm = await loaded(.template(templateID))

        vm.send(.queryChanged("bench"))

        #expect(vm.state.visibleLibrary.map(\.id) == [Fixtures.dumbbellBench.id])
        #expect(
            vm.state.catalog
                == .loaded([
                    CatalogRow(
                        entry: FakeExerciseCatalog.entry(
                            "0025",
                            "Barbell bench press",
                            bodyPart: "chest",
                            target: "pectorals"
                        )
                    )
                ])
        )
    }

    @Test func sourceChangedSwitchesTheList() async {
        let vm = await loaded(.template(templateID))

        vm.send(.sourceChanged(.catalog))

        #expect(vm.state.source == .catalog)
    }

    @Test func libraryTappedAddsToTheTemplateOnceAndGoesBack() async {
        let templates = FakeTemplateRepository()
        let vm = await loaded(.template(templateID), templates: templates)

        let first = vm.send(.libraryTapped(Fixtures.squat.id))
        let second = vm.send(.libraryTapped(Fixtures.squat.id))  // a double tap adds once
        #expect(vm.state.adding == .library(Fixtures.squat.id))
        await first?.value

        #expect(second == nil)
        #expect(templates.calls == [.addExercise(Fixtures.squat.id, to: templateID)])
        #expect(router.backCount == 1)
        #expect(vm.state.adding == nil)
    }

    @Test func catalogTappedAddsTheEntryToTheLibraryThenToTheSession() async {
        let plans = FakeWorkoutPlanRepository()
        let exercises = RecordingCatalogExerciseRepository(emissions: [[]])
        let vm = await loaded(.session(sessionID), plans: plans, exercises: exercises)

        await vm.send(.catalogTapped("0043"))?.value

        #expect(exercises.createdCatalogIDs == ["0043"])
        #expect(plans.calls == [.addExercise(RecordingCatalogExerciseRepository.createdID, to: sessionID)])
        #expect(router.backCount == 1)
    }

    @Test func aFailedAddStaysAndCountsTheFailure() async {
        let plans = FakeWorkoutPlanRepository(error: AppError(.notFound))
        let vm = await loaded(.session(sessionID), plans: plans)

        await vm.send(.libraryTapped(Fixtures.squat.id))?.value

        #expect(router.backCount == 0)
        #expect(vm.state.failures == 1)
    }

    @Test func thumbnailNeededLoadsTheStillOnce() async {
        let vm = await loaded(.template(templateID))

        let task = vm.send(.thumbnailNeeded(catalogID: "0043"))
        #expect(vm.send(.thumbnailNeeded(catalogID: "0043")) == nil)
        await task?.value

        #expect(vm.state.thumbnails["0043"] == .loaded(FakeExerciseCatalog.imageData))
    }
}
