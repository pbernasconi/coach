import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct CatalogDetailViewModelTests {
    let entry = FakeExerciseCatalog.entry("9001", "Barbell Squat")
    let gif = MediaImage.loaded(FakeExerciseCatalog.imageData)
    let router = RecordingNavigator()

    func makeViewModel(
        _ id: String = "9001",
        library: [[Exercise]] = [[]],
        error: AppError? = nil
    ) -> (CatalogDetailViewModel, RecordingCatalogExerciseRepository, FakeExerciseCatalog) {
        let catalog = FakeExerciseCatalog(entries: [entry], images: ["9001": gif])
        let exercises = RecordingCatalogExerciseRepository(emissions: library, error: error)
        let vm = CatalogDetailViewModel(catalogID: id, catalog: catalog, exercises: exercises, router: router)
        return (vm, exercises, catalog)
    }

    func libraryExercise(catalogID: String, archived: Bool = false) -> Exercise {
        Exercise(
            id: IDSequence.id(7),
            name: "My squat",
            equipment: .barbell,
            loadMode: .total,
            primary: [.glutes],
            catalogID: catalogID,
            isArchived: archived,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    @Test func runLoadsTheEntryTheAnimationAndTheLibraryStatus() async {
        let (vm, _, catalog) = makeViewModel()
        await vm.run()
        #expect(vm.state.entry == .loaded(CatalogDetailItem(entry: entry)))
        #expect(vm.state.animation == gif)
        #expect(vm.state.library == .absent)
        #expect(catalog.imageRequests == [.init(kind: .animation, catalogID: "9001")])
        #expect(CatalogDetailItem(entry: entry).target == "Glutes")
    }

    @Test func runShowsInYourLibraryForALiveLinkedExercise() async {
        let (vm, _, _) = makeViewModel(library: [[libraryExercise(catalogID: "9001")]])
        await vm.run()
        #expect(vm.state.library == .present(IDSequence.id(7)))
    }

    @Test func runTreatsAnArchivedLinkAsAbsent() async {
        let (vm, _, _) = makeViewModel(library: [[libraryExercise(catalogID: "9001", archived: true)]])
        await vm.run()
        #expect(vm.state.library == .absent)
    }

    @Test func runShowsEmptyForAnUnknownID() async {
        let (vm, _, _) = makeViewModel("0000")
        await vm.run()
        #expect(vm.state.entry == .empty)
        #expect(vm.state.animation == .failed)
    }

    @Test func addTappedCreatesOnceAndShowsTheToast() async {
        let (vm, exercises, _) = makeViewModel()
        await vm.run()
        let first = vm.send(.addTapped)
        #expect(vm.state.library == .adding)
        #expect(vm.send(.addTapped) == nil)  // a double tap writes once
        await first?.value
        #expect(exercises.createdCatalogIDs == ["9001"])
        #expect(vm.state.library == .present(RecordingCatalogExerciseRepository.createdID))
        #expect(vm.state.toast == CatalogToast(serial: 1, kind: .added(name: "Barbell Squat")))
    }

    @Test func addTappedFailureShowsTheErrorAndAllowsAnotherTry() async {
        let (vm, _, _) = makeViewModel(error: AppError(.unknown))
        await vm.run()
        await vm.send(.addTapped)?.value
        #expect(vm.state.library == .absent)
        #expect(vm.state.toast == CatalogToast(serial: 1, kind: .failed))
    }

    @Test func libraryExerciseTappedOpensTheLibraryExercise() async {
        let (vm, _, _) = makeViewModel(library: [[libraryExercise(catalogID: "9001")]])
        vm.send(.libraryExerciseTapped)
        #expect(router.opened.isEmpty)  // nothing to open before the library is read
        await vm.run()
        vm.send(.libraryExerciseTapped)
        #expect(router.opened == [.exercise(IDSequence.id(7))])
    }
}
