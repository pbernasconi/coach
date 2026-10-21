import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The History tab's Progress view: `run()` and one test per progress Action (TEST-2). No sleeps (TEST-3).
@MainActor
@Suite struct HistoryProgressTests {
    let monday = Fixtures.monday
    let days = DayCalendar(calendar: SessionBuilder.calendar)

    func makeViewModel(_ details: [SessionDetail], segment: HistorySegment = .sessions) -> HistoryViewModel {
        HistoryViewModel(
            sessions: FakeSessionRepository(emissions: [details]),
            exercises: FakeExerciseRepository(emissions: [ExerciseLibrary.seed]),
            router: RecordingNavigator(),
            importFlow: RecordingImportFlow(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar,
            segment: segment,
            opensCoachSessions: false
        )
    }

    func loadedProgress(_ vm: HistoryViewModel) -> VolumeProgress? {
        guard case .loaded(let progress) = vm.state.volume else { return nil }
        return progress
    }

    func sets(_ progress: VolumeProgress?, _ muscle: Muscle) -> Double? {
        progress?.week.muscles.first { $0.id == muscle }?.sets
    }

    /// Squats (quads and glutes primary): 3 logged this week, 4 last week, 2 three weeks ago.
    var squatWeeks: [SessionDetail] {
        [
            SessionBuilder.session(id: 1, on: monday.adding(days: -19), done: 2, planned: 0),
            SessionBuilder.session(id: 2, on: monday.adding(days: -5), done: 4, planned: 1),
            SessionBuilder.session(id: 3, on: monday, done: 3, planned: 2),
        ]
    }

    @Test func runShowsThisWeeksSetsPerMuscleAndTheEightWeekTrend() async throws {
        let vm = makeViewModel(squatWeeks, segment: .progress)

        await vm.run()

        #expect(vm.state.segment == .progress)
        let progress = try #require(loadedProgress(vm))
        #expect(progress.week.id == monday)
        #expect(progress.week.title == "This week")
        #expect(progress.week.total == "3 hard sets")
        #expect(progress.week.muscles.map(\.id) == Muscle.allCases)
        #expect(sets(progress, .quads) == 3)
        #expect(sets(progress, .hamstrings) == 1.5)
        #expect(progress.week.muscles.first { $0.id == .quads }?.status == .below)
        let starts = (0..<8).reversed().map { monday.adding(days: -7 * $0) }
        #expect(progress.trend.map(\.id) == starts)
        #expect(progress.trend.map(\.sets) == [0, 0, 0, 0, 2, 0, 4, 3])
        #expect(progress.trend.map(\.isSelected) == Array(repeating: false, count: 7) + [true])
        #expect(progress.previousWeek == monday.adding(days: -7))
        #expect(progress.nextWeek == nil)
        #expect(progress.scaleMax == 24)
    }

    @Test func runShowsEmptyWithoutHardSets() async {
        let planned = SessionBuilder.session(id: 1, on: monday, done: 0, planned: 3)
        let vm = makeViewModel([planned])

        await vm.run()

        #expect(vm.state.volume == .empty)
        #expect(vm.state.segment == .sessions)
    }

    @Test func segmentChangedSwitchesTheView() {
        let vm = makeViewModel([])

        let task = vm.send(.segmentChanged(.progress))

        #expect(task == nil)
        #expect(vm.state.segment == .progress)
        vm.send(.segmentChanged(.sessions))
        #expect(vm.state.segment == .sessions)
    }

    @Test func volumeWeekSelectedShowsThatWeek() async throws {
        let vm = makeViewModel(squatWeeks)
        await vm.run()

        let task = vm.send(.volumeWeekSelected(monday.adding(days: -7)))

        #expect(task == nil)
        let progress = try #require(loadedProgress(vm))
        #expect(progress.week.title == "Last week")
        #expect(sets(progress, .quads) == 4)
        #expect(progress.nextWeek == monday)
        #expect(progress.trend.last { $0.isSelected }?.id == monday.adding(days: -7))
    }

    @Test func volumeTrendSelectionChangedPicksTheTouchedWeekAndKeepsItOnRelease() async throws {
        let vm = makeViewModel(squatWeeks)
        await vm.run()
        let touched = try #require(days.date(of: monday.adding(days: -17)))

        let task = vm.send(.volumeTrendSelectionChanged(touched))
        vm.send(.volumeTrendSelectionChanged(nil))

        #expect(task == nil)
        let progress = try #require(loadedProgress(vm))
        #expect(progress.week.id == monday.adding(days: -21))
        #expect(progress.week.title == days.weekTitle(start: monday.adding(days: -21)))
        #expect(sets(progress, .glutes) == 2)
    }

    @Test func muscleTappedListsTheExercisesOfTheShownWeek() async throws {
        let vm = makeViewModel(squatWeeks)
        await vm.run()
        vm.send(.volumeWeekSelected(monday.adding(days: -7)))

        let task = vm.send(.muscleTapped(.hamstrings))

        #expect(task == nil)
        let detail = try #require(vm.state.muscleDetail)
        #expect(detail.id == .hamstrings)
        #expect(detail.title == "Hamstrings")
        #expect(detail.subtitle == "Last week · 2 hard sets")
        #expect(detail.rows.map(\.name) == ["Back squat"])
        #expect(detail.rows.map(\.detail) == ["Secondary · 4 sets at half credit"])
        #expect(detail.rows.map(\.value) == ["2"])
    }

    @Test func muscleDetailDismissedClosesTheSheet() async {
        let vm = makeViewModel(squatWeeks)
        await vm.run()
        vm.send(.muscleTapped(.calves))
        #expect(vm.state.muscleDetail?.rows.isEmpty == true)

        let task = vm.send(.muscleDetailDismissed)

        #expect(task == nil)
        #expect(vm.state.muscleDetail == nil)
    }
}
