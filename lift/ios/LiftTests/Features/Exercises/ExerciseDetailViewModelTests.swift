import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct ExerciseDetailViewModelTests {
    let squatID = ExerciseLibrary.seedID(1)

    func makeViewModel(
        _ exerciseID: UUID,
        library: [Exercise] = ExerciseLibrary.seed,
        history: FakeExerciseHistoryRepository = FakeExerciseHistoryRepository(emissions: [[]]),
        catalog: FakeExerciseCatalog = FakeExerciseCatalog()
    ) -> ExerciseDetailViewModel {
        ExerciseDetailViewModel(
            exerciseID: exerciseID,
            exercises: FakeExerciseRepository(emissions: [library]),
            history: history,
            catalog: catalog,
            calendar: SessionBuilder.calendar
        )
    }

    /// A logged set with the given values.
    static func set(_ number: UInt64, reps: Int, weight: Weight?, kind: SetKind = .working) -> SetRecord {
        var set = SetRecord(
            id: IDSequence.id(number, prefix: 0xC0),
            sessionExerciseID: IDSequence.id(1, prefix: 0xB0),
            position: Int(number),
            kind: kind,
            target: SetTarget(reps: reps, weight: weight),
            unit: .kg,
            loadMode: .total,
            createdAt: ManualNow.start
        )
        set.status = .done
        set.actualReps = reps
        set.actualWeight = weight
        return set
    }

    static func entry(_ sets: [SetRecord], loadMode: LoadMode = .total) -> ExerciseHistoryEntry {
        let session = SessionRecord(
            id: IDSequence.id(1, prefix: 0xA0),
            day: Fixtures.monday,
            title: "Lower A",
            unitsAtLog: .kg,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        return ExerciseHistoryEntry(session: session, loadMode: loadMode, sets: sets)
    }

    @Test func runLoadsTheExerciseWithItsGuideAndAsksForFiveSessions() async throws {
        let history = FakeExerciseHistoryRepository(emissions: [[]])
        let vm = makeViewModel(squatID, history: history)

        await vm.run()

        guard case .loaded(let item) = vm.state.exercise else {
            Issue.record("not loaded: \(vm.state.exercise)")
            return
        }
        #expect(item.name == "Back squat")
        #expect(item.equipment == "Barbell")
        #expect(item.primary == ["Quads", "Glutes"])
        #expect(item.guide == ExerciseGuide.for(id: squatID))
        #expect(vm.state.media == nil)
        #expect(vm.state.history == .empty)
        #expect(history.requested == [.init(exerciseID: squatID, limit: 5)])
    }

    @Test func runShowsEmptyWhenTheExerciseIsGone() async {
        let vm = makeViewModel(UUID(uuid: (9, 9, 9, 9, 9, 9, 0x40, 9, 0x80, 9, 9, 9, 9, 9, 9, 9)))

        await vm.run()

        #expect(vm.state.exercise == .empty)
    }

    @Test func runListsHistoryWithTheBestSetByEstimatedMax() async {
        let sets = [
            Self.set(1, reps: 10, weight: .kg(40), kind: .warmUp),
            Self.set(2, reps: 5, weight: .kg(100)),
            Self.set(3, reps: 3, weight: .kg(110)),
        ]
        let vm = makeViewModel(squatID, history: FakeExerciseHistoryRepository(emissions: [[Self.entry(sets)]]))

        await vm.run()

        let expected = ExerciseHistoryRow(
            id: IDSequence.id(1, prefix: 0xA0),
            dayTitle: DayCalendar(calendar: SessionBuilder.calendar).shortTitle(of: Fixtures.monday),
            best: "3 @ 110 kg",
            sets: "3 sets",
            estimate: "Est. 1RM 121 kg"
        )
        #expect(vm.state.history == .loaded([expected]))
    }

    @Test func historyOfABodyweightSetShowsRepsWithoutAnEstimate() {
        let entry = Self.entry([Self.set(1, reps: 8, weight: nil)], loadMode: .bodyweight(added: nil))

        let row = ExerciseHistoryRow(entry: entry, days: DayCalendar(calendar: SessionBuilder.calendar))

        #expect(row.best == "8 reps")
        #expect(row.estimate == nil)
    }

    @Test func videosTappedOpensTheGuideSearchEachTime() async {
        let vm = makeViewModel(squatID)
        await vm.run()

        let task = vm.send(.videosTapped)
        #expect(task == nil)
        #expect(
            vm.state.link?.url.absoluteString == "https://www.youtube.com/results?search_query=back%20squat%20technique"
        )
        #expect(vm.state.link?.serial == 1)

        vm.send(.videosTapped)
        #expect(vm.state.link?.serial == 2)
    }

    @Test func videosTappedSearchesByNameForAnExerciseWithoutAGuide() async {
        let custom = Exercise(
            id: IDSequence.id(7),
            name: "Landmine press",
            equipment: .barbell,
            loadMode: .total,
            primary: [.shoulders],
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        let vm = makeViewModel(custom.id, library: [custom])
        await vm.run()

        vm.send(.videosTapped)

        #expect(vm.state.link?.url == ExerciseGuide.videoSearchURL(for: "Landmine press technique"))
    }

    @Test func videosTappedBeforeLoadingDoesNothing() {
        let vm = makeViewModel(squatID)

        vm.send(.videosTapped)

        #expect(vm.state.link == nil)
    }

    @Test func runShowsCatalogMediaAndLoadAnimationLoadsIt() async {
        let gif = MediaImage.loaded(FakeExerciseCatalog.imageData)
        let catalog = FakeExerciseCatalog(
            entries: [FakeExerciseCatalog.entry("0043", "Barbell Full Squat")],
            images: ["0043": gif]
        )
        let vm = makeViewModel(squatID, catalog: catalog)

        await vm.run()
        #expect(vm.state.media?.gifURL.lastPathComponent == "0043-abc.gif")
        #expect(vm.state.media?.attribution == "Made-up credit")
        #expect(vm.state.librarySteps.isEmpty)  // the squat has an authored guide
        #expect(vm.state.animation == .loading)

        await vm.loadAnimation()
        #expect(vm.state.animation == gif)
        #expect(catalog.imageRequests == [.init(kind: .animation, catalogID: "0043")])
    }

    @Test func runShowsLibraryStepsForACatalogExerciseWithoutAGuide() async {
        let added = Exercise(
            id: IDSequence.id(8),
            name: "Made-Up Row",
            equipment: .cable,
            loadMode: .total,
            primary: [.back],
            catalogID: "9002",
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        let catalog = FakeExerciseCatalog(entries: [FakeExerciseCatalog.entry("9002", "Made-Up Row")])
        let vm = makeViewModel(added.id, library: [added], catalog: catalog)

        await vm.run()

        #expect(vm.state.librarySteps == ["Step one.", "Step two."])
        #expect(vm.state.media != nil)
    }

    @Test func loadAnimationDoesNothingWithoutMedia() async {
        let vm = makeViewModel(squatID)
        await vm.run()
        await vm.loadAnimation()
        #expect(vm.state.animation == .loading)
        #expect(vm.state.media == nil)
    }

    @Test func libraryStepsExpandedChangedOpensAndCloses() {
        let vm = makeViewModel(squatID)

        #expect(vm.send(.libraryStepsExpandedChanged(true)) == nil)
        #expect(vm.state.isLibraryStepsExpanded)
        vm.send(.libraryStepsExpandedChanged(false))
        #expect(!vm.state.isLibraryStepsExpanded)
    }
}
