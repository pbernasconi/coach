import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import Lift

/// The progress chart on the catalog detail screen, shown once the entry is in the library with history: one test per
/// progress Action and `observeProgress()` (TEST-2).
@MainActor
@Suite struct CatalogDetailProgressTests {
    let libraryID = IDSequence.id(7)

    func makeViewModel(
        inLibrary: Bool = true,
        history: FakeExerciseHistoryRepository
    ) -> CatalogDetailViewModel {
        let linked = Exercise(
            id: libraryID,
            name: "My squat",
            equipment: .barbell,
            loadMode: .total,
            primary: [.glutes],
            catalogID: "9001",
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        return CatalogDetailViewModel(
            catalogID: "9001",
            catalog: FakeExerciseCatalog(entries: [FakeExerciseCatalog.entry("9001", "Barbell Squat")]),
            exercises: RecordingCatalogExerciseRepository(emissions: [inLibrary ? [linked] : []], error: nil),
            router: RecordingNavigator(),
            history: history,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            unit: .kg
        )
    }

    /// The charted sessions; none while the chart is hidden.
    func points(_ vm: CatalogDetailViewModel) -> [ProgressChartPoint] {
        guard case .loaded(let chart) = vm.state.progress.chart else { return [] }
        return chart.points
    }

    @Test func observeProgressChartsTheLibraryExercise() async {
        let history = FakeExerciseHistoryRepository(emissions: [HistoryEntryBuilder.weekly(4)])
        let vm = makeViewModel(history: history)
        await vm.run()
        #expect(vm.libraryExerciseID == libraryID)

        await vm.observeProgress()

        #expect(history.requested == [.init(exerciseID: libraryID, limit: ExerciseProgressTracker.sessionLimit)])
        #expect(points(vm).count == 4)
    }

    @Test func observeProgressHidesTheChartOutsideTheLibrary() async {
        let history = FakeExerciseHistoryRepository(emissions: [HistoryEntryBuilder.weekly(4)])
        let vm = makeViewModel(inLibrary: false, history: history)
        await vm.run()

        await vm.observeProgress()

        #expect(vm.libraryExerciseID == nil)
        #expect(history.requested.isEmpty)
        #expect(vm.state.progress.chart == .empty)
    }

    @Test func observeProgressHidesTheChartWithoutHistory() async {
        let vm = makeViewModel(history: FakeExerciseHistoryRepository(emissions: [[]]))
        await vm.run()

        await vm.observeProgress()

        #expect(vm.state.progress.chart == .empty)
    }

    @Test func progressRangeChangedChartsTheChosenRange() async {
        let old = HistoryEntryBuilder.entry(9, daysAgo: 300, kilograms: 60)
        let vm = makeViewModel(
            history: FakeExerciseHistoryRepository(emissions: [HistoryEntryBuilder.weekly(2) + [old]])
        )
        await vm.run()
        await vm.observeProgress()

        let task = vm.send(.progressRangeChanged(.year))

        #expect(task == nil)
        #expect(vm.state.progress.range == .year)
        #expect(points(vm).first?.id == old.id)
    }

    @Test func progressSelectionChangedSelectsTheNearestSession() async throws {
        let entries = HistoryEntryBuilder.weekly(2)
        let vm = makeViewModel(history: FakeExerciseHistoryRepository(emissions: [entries]))
        await vm.run()
        await vm.observeProgress()
        let newest = try #require(points(vm).last)

        let task = vm.send(.progressSelectionChanged(newest.date))

        #expect(task == nil)
        guard case .loaded(let chart) = vm.state.progress.chart else {
            Issue.record("no chart")
            return
        }
        #expect(chart.selectedID == entries[0].id)
        vm.send(.progressSelectionChanged(nil))
        if case .loaded(let cleared) = vm.state.progress.chart { #expect(cleared.selectedID == nil) }
    }
}
