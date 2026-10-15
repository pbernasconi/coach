import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The progress chart on the exercise detail screen: `run()` and one test per progress Action (TEST-2).
@MainActor
@Suite struct ExerciseDetailProgressTests {
    let squatID = ExerciseLibrary.seedID(1)
    let days = DayCalendar(calendar: SessionBuilder.calendar)

    func makeViewModel(_ entries: [ExerciseHistoryEntry]) -> ExerciseDetailViewModel {
        ExerciseDetailViewModel(
            exerciseID: squatID,
            exercises: FakeExerciseRepository(emissions: [ExerciseLibrary.seed]),
            history: FakeExerciseHistoryRepository(emissions: [entries]),
            catalog: FakeExerciseCatalog(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            unit: .kg
        )
    }

    func loadedChart(_ vm: ExerciseDetailViewModel) -> ExerciseProgressChart? {
        guard case .loaded(let chart) = vm.state.progress.chart else { return nil }
        return chart
    }

    @Test func runChartsEverySessionAndListsTheLatestFive() async throws {
        let entries = HistoryEntryBuilder.weekly(8)
        let vm = makeViewModel(entries)

        await vm.run()

        let chart = try #require(loadedChart(vm))
        guard case .loaded(let rows) = vm.state.history else {
            Issue.record("history not loaded: \(vm.state.history)")
            return
        }
        #expect(rows.map(\.id) == entries.prefix(5).map(\.id))
        #expect(chart.points.map(\.id) == entries.reversed().map(\.id))
        #expect(chart.points.last?.heaviest == 97.5)
        #expect(chart.points.last?.estimate == 114)
        let since = days.monthDayTitle(of: Fixtures.monday.adding(days: -56))
        #expect(
            chart.headline
                == ProgressHeadline(label: "Best est. 1RM", value: "114 kg", detail: "+20.5 kg since \(since)")
        )
        #expect(chart.selectedID == nil)
        #expect(chart.emptyMessage == nil)
        #expect(vm.state.progress.range == .threeMonths)
    }

    @Test func oneSessionShowsItsBestWithoutAChange() async throws {
        let vm = makeViewModel([HistoryEntryBuilder.entry(1, daysAgo: 3, kilograms: 90)])

        await vm.run()

        let chart = try #require(loadedChart(vm))
        #expect(chart.points.count == 1)
        #expect(chart.headline == ProgressHeadline(label: "Best est. 1RM", value: "105 kg", detail: nil))
        #expect(chart.domain.lowerBound < chart.domain.upperBound)
    }

    @Test func progressRangeChangedChartsTheChosenRange() async throws {
        let old = HistoryEntryBuilder.entry(9, daysAgo: 200, kilograms: 60)
        let vm = makeViewModel(HistoryEntryBuilder.weekly(2) + [old])
        await vm.run()
        #expect(loadedChart(vm)?.points.count == 2)

        let task = vm.send(.progressRangeChanged(.all))

        #expect(task == nil)
        #expect(vm.state.progress.range == .all)
        #expect(loadedChart(vm)?.points.first?.id == old.id)
        #expect(loadedChart(vm)?.points.count == 3)
        vm.send(.progressRangeChanged(.threeMonths))
        #expect(loadedChart(vm)?.points.count == 2)
    }

    @Test func progressRangeChangedToAnEmptyRangeSaysSo() async throws {
        let vm = makeViewModel([HistoryEntryBuilder.entry(1, daysAgo: 200, kilograms: 60)])
        await vm.run()

        vm.send(.progressRangeChanged(.sixMonths))

        let chart = try #require(loadedChart(vm))
        #expect(chart.points.isEmpty)
        #expect(chart.emptyMessage == "No sessions in the last 6 months")
    }

    @Test func progressSelectionChangedShowsTheNearestSessionUntilLetGo() async throws {
        let entries = HistoryEntryBuilder.weekly(3)
        let vm = makeViewModel(entries)
        await vm.run()
        let touched = try #require(loadedChart(vm)?.points.first { $0.id == entries[1].id })

        let task = vm.send(.progressSelectionChanged(touched.date.addingTimeInterval(2 * 3_600)))

        #expect(task == nil)
        let selected = try #require(loadedChart(vm))
        let day = days.shortTitle(of: entries[1].session.day)
        #expect(selected.selectedID == entries[1].id)
        #expect(
            selected.headline
                == ProgressHeadline(label: "\(day) · Est. 1RM", value: "96.5 kg", detail: "Top set 5 @ 82.5 kg")
        )
        vm.send(.progressSelectionChanged(nil))
        #expect(loadedChart(vm)?.selectedID == nil)
        #expect(loadedChart(vm)?.headline.label == "Best est. 1RM")
    }
}
