import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct CatalogViewModelTests {
    let squat = FakeExerciseCatalog.entry("9001", "Barbell Squat")
    let curl = FakeExerciseCatalog.entry(
        "9002",
        "Dumbbell Curl",
        bodyPart: "upper arms",
        equipment: "dumbbell",
        target: "biceps"
    )
    let lunge = FakeExerciseCatalog.entry(
        "9003",
        "Squat Lunge",
        equipment: "body weight",
        target: "quads"
    )
    let router = RecordingNavigator()

    var all: [CatalogRow] {
        [CatalogRow(entry: squat), CatalogRow(entry: curl), CatalogRow(entry: lunge)]
    }

    /// A library exercise linked to `catalogID`.
    static func linked(_ number: UInt64, _ catalogID: String?, archived: Bool = false) -> Exercise {
        Exercise(
            id: IDSequence.id(number),
            name: "Made-up \(number)",
            equipment: .barbell,
            loadMode: .total,
            primary: [.glutes],
            catalogID: catalogID,
            isArchived: archived,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    func makeViewModel(_ catalog: FakeExerciseCatalog, library: [[Exercise]] = []) -> CatalogViewModel {
        CatalogViewModel(
            catalog: catalog,
            exercises: FakeExerciseRepository(emissions: library),
            router: router
        )
    }

    func loaded(
        images: [String: MediaImage] = [:],
        library: [[Exercise]] = []
    ) async -> (CatalogViewModel, FakeExerciseCatalog) {
        let catalog = FakeExerciseCatalog(entries: [squat, curl, lunge], images: images)
        let vm = makeViewModel(catalog, library: library)
        await vm.run()
        return (vm, catalog)
    }

    @Test func runLoadsEveryEntryByNameWithFacetsAndCounts() async {
        let (vm, _) = await loaded()
        #expect(vm.state.total == 3)
        #expect(vm.state.rows == .loaded(all))
        #expect(vm.state.options[.bodyPart] == ["upper arms", "upper legs"])
        #expect(vm.state.options[.target] == ["biceps", "glutes", "quads"])
        #expect(vm.state.options[.equipment] == ["barbell", "body weight", "dumbbell"])
        #expect(vm.state.counts.count("upper legs", in: .bodyPart) == 2)
        #expect(CatalogRow(entry: curl).detail == "Biceps · Dumbbell")
        #expect(!vm.state.isFiltered)
        #expect(vm.state.library.isEmpty)
    }

    @Test func runFollowsTheLibraryLinks() async {
        let library = [
            [Self.linked(1, "9002")],
            [Self.linked(1, "9002"), Self.linked(2, nil), Self.linked(3, "9003")],
        ]
        let (vm, _) = await loaded(library: library)
        #expect(vm.state.library == ["9002", "9003"])
        #expect(vm.state.counts.inLibrary == 2)
    }

    @Test func runDropsInLibraryWhenTheLibraryLinksNothing() async {
        let catalog = FakeExerciseCatalog(entries: [squat, curl, lunge])
        let library = [[Self.linked(1, "9001")], [Self.linked(1, "9001", archived: true)]]
        let vm = makeViewModel(catalog, library: library)
        vm.send(.libraryToggled)
        await vm.run()
        #expect(vm.state.library.isEmpty)
        #expect(!vm.state.filter.inLibrary)
        #expect(vm.state.rows == .loaded(all))
    }

    @Test func runShowsEmptyAndFailed() async {
        let empty = makeViewModel(FakeExerciseCatalog(entries: []))
        await empty.run()
        #expect(empty.state.rows == .empty)
        let failing = makeViewModel(FakeExerciseCatalog(fails: true))
        await failing.run()
        #expect(failing.state.rows == .failed(.decoding))
    }

    @Test func queryChangedRanksMatches() async {
        let (vm, _) = await loaded()
        vm.send(.queryChanged("squat"))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: lunge), CatalogRow(entry: squat)]))
        #expect(vm.state.counts.count("upper arms", in: .bodyPart) == 0)
        #expect(vm.state.isFiltered)
        vm.send(.queryChanged("nothing like it"))
        #expect(vm.state.rows == .loaded([]))
    }

    @Test func filtersTappedOpensEveryFilter() async {
        let (vm, _) = await loaded()
        vm.send(.filtersTapped)
        #expect(vm.state.sheet == .all)
    }

    @Test func facetTappedOpensThatFacet() async {
        let (vm, _) = await loaded()
        vm.send(.facetTapped(.equipment))
        #expect(vm.state.sheet == .facet(.equipment))
    }

    @Test func optionToggledFiltersWithOrInsideAndAndAcrossFacets() async {
        let (vm, _) = await loaded()
        vm.send(.optionToggled(.equipment, "barbell"))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: squat)]))
        vm.send(.optionToggled(.equipment, "dumbbell"))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: squat), CatalogRow(entry: curl)]))
        #expect(vm.state.chosenLabels(.equipment) == ["Barbell", "Dumbbell"])
        vm.send(.optionToggled(.bodyPart, "upper arms"))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: curl)]))
        #expect(vm.state.filter.activeCount == 2)
        #expect(vm.state.counts.count("body weight", in: .equipment) == 0)
        vm.send(.optionToggled(.equipment, "dumbbell"))
        #expect(vm.state.rows == .loaded([]))
        #expect(vm.state.choices(.equipment).map(\.isOn) == [true, false, false])
    }

    @Test func libraryToggledKeepsLinkedEntries() async {
        let (vm, _) = await loaded(library: [[Self.linked(1, "9003")]])
        vm.send(.libraryToggled)
        #expect(vm.state.rows == .loaded([CatalogRow(entry: lunge)]))
        #expect(vm.state.filter.activeCount == 1)
        vm.send(.libraryToggled)
        #expect(vm.state.rows == .loaded(all))
    }

    @Test func facetClearedClearsOnlyThatFacet() async {
        let (vm, _) = await loaded()
        vm.send(.optionToggled(.equipment, "barbell"))
        vm.send(.optionToggled(.bodyPart, "upper legs"))
        vm.send(.facetCleared(.equipment))
        #expect(vm.state.filter == CatalogFilter(selections: [.bodyPart: ["upper legs"]]))
        #expect(vm.state.rows == .loaded([CatalogRow(entry: squat), CatalogRow(entry: lunge)]))
    }

    @Test func filtersClearedTurnsEveryFilterOffAndKeepsTheQuery() async {
        let (vm, _) = await loaded(library: [[Self.linked(1, "9001")]])
        vm.send(.queryChanged("squat"))
        vm.send(.optionToggled(.target, "glutes"))
        vm.send(.libraryToggled)
        vm.send(.filtersCleared)
        #expect(vm.state.filter.isEmpty)
        #expect(vm.state.rows == .loaded([CatalogRow(entry: lunge), CatalogRow(entry: squat)]))
    }

    @Test func sheetDismissedClosesTheSheetAndKeepsTheFilters() async {
        let (vm, _) = await loaded()
        vm.send(.facetTapped(.target))
        vm.send(.optionToggled(.target, "biceps"))
        vm.send(.sheetDismissed)
        #expect(vm.state.sheet == nil)
        #expect(vm.state.rows == .loaded([CatalogRow(entry: curl)]))
        #expect(vm.state.resultCount == 1)
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
        #expect(
            catalog.imageRequests == [
                .init(kind: .still, catalogID: "9001"), .init(kind: .still, catalogID: "9002"),
            ]
        )
        #expect(vm.send(.rowAppeared("0000")) == nil)
    }

    @Test func rowTappedOpensTheCatalogExercise() async {
        let (vm, _) = await loaded()
        vm.send(.rowTapped("9002"))
        #expect(router.opened == [.catalogExercise("9002")])
    }

    @Test func retryTappedLoadsAgain() async {
        let vm = makeViewModel(FakeExerciseCatalog(fails: true))
        await vm.run()
        let task = vm.send(.retryTapped)
        #expect(vm.state.rows == .loading)
        await task?.value
        #expect(vm.state.rows == .failed(.decoding))
    }
}
