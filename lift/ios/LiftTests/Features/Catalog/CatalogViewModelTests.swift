import Foundation
import LiftCore
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct CatalogViewModelTests {
    let squat = FakeExerciseCatalog.entry("9001", "Barbell Squat")
    let curl = FakeExerciseCatalog.entry("9002", "Dumbbell Curl", bodyPart: "upper arms", equipment: "dumbbell", target: "biceps")
    let lunge = FakeExerciseCatalog.entry("9003", "Squat Lunge", equipment: "body weight", target: "quads")
    let router = RecordingNavigator()

    func makeViewModel(_ catalog: FakeExerciseCatalog) -> CatalogViewModel {
        CatalogViewModel(catalog: catalog, router: router)
    }

    func loaded(images: [String: MediaImage] = [:]) async -> (CatalogViewModel, FakeExerciseCatalog) {
        let catalog = FakeExerciseCatalog(entries: [squat, curl, lunge], images: images)
        let vm = makeViewModel(catalog)
        await vm.run()
        return (vm, catalog)
    }

    @Test func runLoadsEveryEntryByNameWithFacets() async {
        let (vm, _) = await loaded()
        #expect(vm.state.total == 3)
        #expect(vm.state.rows == .loaded([CatalogRow(entry: squat), CatalogRow(entry: curl), CatalogRow(entry: lunge)]))
        #expect(vm.state.bodyParts == ["upper arms", "upper legs"])
        #expect(vm.state.equipmentKinds == ["barbell", "body weight", "dumbbell"])
        #expect(CatalogRow(entry: curl).detail == "Biceps · Dumbbell")
        #expect(!vm.state.isFiltered)
    }

    @Test func runShowsEmptyAndFailed() async {
        let empty = makeViewModel(FakeExerciseCatalog(entries: []))
        await empty.run()
        #expect(empty.state.rows == .empty)
        let failing = makeViewModel(FakeExerciseCatalog(entries: nil))
        await failing.run()
        #expect(failing.state.rows == .failed(.decoding))
    }

    @Test func queryChangedRanksMatches() async {
        let (vm, _) = await loaded()
        vm.send(.queryChanged("squat"))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: lunge), CatalogRow(entry: squat)]))
        #expect(vm.state.isFiltered)
        vm.send(.queryChanged("nothing like it"))
        #expect(vm.state.rows == .loaded([]))
    }

    @Test func bodyPartChangedFilters() async {
        let (vm, _) = await loaded()
        vm.send(.bodyPartChanged(.only("upper arms")))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: curl)]))
        vm.send(.bodyPartChanged(.any))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: squat), CatalogRow(entry: curl), CatalogRow(entry: lunge)]))
    }

    @Test func equipmentChangedFiltersWithTheQuery() async {
        let (vm, _) = await loaded()
        vm.send(.queryChanged("squat"))
        vm.send(.equipmentChanged(.only("barbell")))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: squat)]))
        #expect(vm.state.equipment == .only("barbell"))
    }

    @Test func rowAppearedLoadsItsStillOnce() async {
        let still = MediaImage.loaded(FakeExerciseCatalog.imageData)
        let (vm, catalog) = await loaded(images: ["9001": still])
        let first = vm.send(.rowAppeared("9001"))
        #expect(vm.state.thumbnails["9001"] == .loading)
        #expect(vm.send(.rowAppeared("9001")) == nil)
        await first?.value
        #expect(vm.state.thumbnails["9001"] == still)
        await vm.send(.rowAppeared("9002"))?.value
        #expect(vm.state.thumbnails["9002"] == .failed)
        #expect(catalog.imageRequests == [.init(kind: .still, catalogID: "9001"), .init(kind: .still, catalogID: "9002")])
        #expect(vm.send(.rowAppeared("0000")) == nil)
    }

    @Test func rowTappedOpensTheCatalogExercise() async {
        let (vm, _) = await loaded()
        vm.send(.rowTapped("9002"))
        #expect(router.opened == [.catalogExercise("9002")])
    }

    @Test func retryTappedLoadsAgain() async {
        let vm = makeViewModel(FakeExerciseCatalog(entries: nil))
        await vm.run()
        let task = vm.send(.retryTapped)
        #expect(vm.state.rows == .loading)
        await task?.value
        #expect(vm.state.rows == .failed(.decoding))
    }
}
