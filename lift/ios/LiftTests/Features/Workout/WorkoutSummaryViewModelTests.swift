import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct WorkoutSummaryViewModelTests {
    let router = RecordingNavigator()
    let health = RecordingHealthRecorder()

    /// Monday: three squat sets logged, the first at 09:00 and the last at 09:30, then finished.
    var detail: SessionDetail {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 3, planned: 0)
        for index in detail.items[0].sets.indices {
            detail.items[0].sets[index].actualReps = 5
            detail.items[0].sets[index].actualWeight = .kg(105)
            detail.items[0].sets[index].completedAt = ManualNow.start.addingTimeInterval(Double(index) * 900)
        }
        detail.session.finishedAt = ManualNow.start.addingTimeInterval(1_800)
        return detail
    }

    /// A squat session a week earlier at 100 kg.
    var earlier: ExerciseHistoryEntry {
        var session = SessionBuilder.session(id: 2, on: Fixtures.monday.adding(days: -7), done: 3, planned: 0)
        for index in session.items[0].sets.indices {
            session.items[0].sets[index].actualReps = 5
            session.items[0].sets[index].actualWeight = .kg(100)
        }
        return ExerciseHistoryEntry(session: session.session, loadMode: .total, sets: session.items[0].sets)
    }

    @Test func runShowsTheNumbersAndTheBests() async {
        let history = FakeExerciseHistoryRepository(emissions: [[earlier]])
        let vm = WorkoutSummaryViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [detail]),
            history: history,
            health: health,
            router: router,
            calendar: SessionBuilder.calendar
        )

        await vm.run()

        guard case .loaded(let summary) = vm.state.summary else {
            Issue.record("expected a summary")
            return
        }
        #expect(summary.title == "Lower A")
        #expect(summary.duration == WorkoutSummaryText.duration(1_800))
        #expect(summary.sets == "3")
        // One row for the squat: 105 kg beats 100 kg, and 105 × 7/6 = 122.5 beats 100 × 7/6 = 116.67 (116.5).
        #expect(summary.bests.map(\.value) == ["105 kg"])
        #expect(summary.bests.map(\.detail) == ["105 kg × 5 · est. 1RM 122.5 kg (was 116.5)"])
        #expect(history.requested.map(\.exerciseID) == [Fixtures.squat.id])
    }

    @Test func runWithoutTheSessionIsEmpty() async {
        let vm = WorkoutSummaryViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [nil]),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: health,
            router: router,
            calendar: SessionBuilder.calendar
        )

        await vm.run()

        #expect(vm.state.summary == .empty)
    }

    @Test func doneTappedGoesBack() {
        let vm = WorkoutSummaryViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: []),
            history: FakeExerciseHistoryRepository(emissions: []),
            health: health,
            router: router,
            calendar: SessionBuilder.calendar
        )

        #expect(vm.send(.doneTapped) == nil)
        #expect(router.backCount == 1)
    }

    func summary(health status: HealthStatus, saved: Bool = false) async -> WorkoutSummaryViewModel {
        health.statusAnswer = status
        var detail = detail
        if saved { detail.session.healthWorkoutID = IDSequence.id(9, prefix: 0xEE) }
        let vm = WorkoutSummaryViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [detail]),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: health,
            router: router,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return vm
    }

    @Test func theFirstFinishAsksAboutAppleHealth() async {
        #expect(await summary(health: .notAsked).state.health == .ask)
        #expect(await summary(health: .on).state.health == nil)
        #expect(await summary(health: .off).state.health == nil)
        #expect(await summary(health: .notSaved).state.health == nil)
        #expect(await summary(health: .on, saved: true).state.health == .saved)
        #expect(health.calls.isEmpty)
    }

    @Test func healthAllowTappedAsksHealthAndSavesThisWorkout() async {
        let vm = await summary(health: .notAsked)

        let task = vm.send(.healthAllowTapped)
        #expect(vm.send(.healthAllowTapped) == nil)  // a double tap asks once
        await task?.value

        #expect(health.calls == [.allow(detail.id)])
        #expect(vm.state.health == nil)
    }

    @Test func healthNotNowTappedTurnsSavingOff() async {
        let vm = await summary(health: .notAsked)

        await vm.send(.healthNotNowTapped)?.value

        #expect(health.calls == [.setEnabled(false)])
        #expect(vm.state.health == nil)
    }
}
