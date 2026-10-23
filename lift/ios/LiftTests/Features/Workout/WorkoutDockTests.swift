import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The workout dock (`WorkoutState.dock`): Start, then the set to do now, the rest, the rest over and Finish, from the
/// same view of the workout as the Lock Screen. Made-up sessions only (TEST-8).
@Suite struct WorkoutDockTests {
    typealias Fixture = RestActivityStartTests
    static let start = Date(timeIntervalSince1970: 1_772_442_000)

    func state(_ statuses: [SetStatus], started: Bool = true, finished: Bool = false) -> WorkoutState {
        var overview = WorkoutOverview(
            title: "Lower A",
            dayTitle: "Monday, 2 March",
            loggedSets: statuses.count(where: { $0 != .planned }),
            totalSets: statuses.count,
            exercises: [
                Fixture.exercise(10, "Back squat", sets: [Fixture.set(11, "Set 1", statuses[0]), Fixture.set(12, "Set 2", statuses[1])]),
                Fixture.exercise(20, "Romanian deadlift", sets: [Fixture.set(21, "Set 1", statuses[2])]),
            ]
        )
        overview.startedAt = started ? Self.start : nil
        overview.finishedAt = finished ? Self.start.addingTimeInterval(3_000) : nil
        var state = WorkoutState()
        state.workout = .loaded(overview)
        return state
    }

    @Test func beforeTheStartItIsStartWorkout() {
        #expect(state([.planned, .planned, .planned], started: false).dock == .start)
    }

    @Test func aFinishedWorkoutHasNoDock() {
        #expect(state([.done, .done, .done], finished: true).dock == nil)
        #expect(WorkoutState().dock == nil)
    }

    @Test func liftingOffersTheSetAfterTheLastOneLogged() {
        guard case .lifting(let content, let since) = state([.done, .planned, .planned]).dock else {
            Issue.record("not lifting")
            return
        }
        #expect(content.current?.id == .fixture(12))
        #expect(content.dots == [.done, .current])
        #expect(content.loggedSets == 1)
        #expect(since == Self.start)
    }

    @Test func restingShowsTheNextSetUnderTheCountdown() {
        var resting = state([.done, .planned, .planned])
        resting.rest = RestTimer(run: 1, seconds: 90, setID: .fixture(11))
        guard case .resting(let content, let rest, _) = resting.dock else {
            Issue.record("not resting")
            return
        }
        #expect(content.current?.id == .fixture(12))
        #expect(rest.remaining == 90)
    }

    @Test func aRestThatRanOutOffersItsSet() {
        var ready = state([.done, .planned, .planned])
        ready.ready = RestReady(setID: .fixture(21), title: "Romanian deadlift · Set 1", target: "5 @ 100 kg", since: Self.start)
        guard case .ready(let content, _, _) = ready.dock else {
            Issue.record("not ready")
            return
        }
        #expect(content.current?.id == .fixture(21))
        #expect(content.exerciseNumber == 2)
    }

    @Test func withEverySetDoneItOffersFinish() {
        guard case .complete(let content, _) = state([.done, .skipped, .done]).dock else {
            Issue.record("not complete")
            return
        }
        #expect(content.current == nil)
    }

    @Test func theLoadReadsAsOnTheLockScreen() {
        let set = WorkoutActivitySet(id: .fixture(1), exerciseName: "Back squat", title: "Set 1", weight: "100", unit: "kg", reps: "5")
        #expect(set.loadText == "100 kg × 5")
        var noWeight = set
        noWeight.weight = nil
        #expect(noWeight.loadText == "5 reps")
    }

    @Test func theRestRingsTheCheckOfTheSetAfterIt() {
        var resting = state([.done, .planned, .planned])
        resting.rest = RestTimer(run: 1, seconds: 90, setID: .fixture(11))

        #expect(resting.setRowRest == SetRowRest(setID: .fixture(12), timer: RestTimer(run: 1, seconds: 90, setID: .fixture(11))))
        #expect(state([.done, .planned, .planned]).setRowRest == nil)
    }

    @Test func theFirstSetOfTheNextExerciseOffersStartOnce() {
        var next = state([.done, .done, .planned])
        #expect(next.dockIntroducesExercise)

        next.startedExerciseSetID = .fixture(21)
        #expect(!next.dockIntroducesExercise)
        #expect(!state([.done, .planned, .planned]).dockIntroducesExercise)
        #expect(!state([.planned, .planned, .planned]).dockIntroducesExercise)
    }

    @Test func plannedSetsLeftCountsWhatFinishWouldLeave() {
        #expect(state([.done, .skipped, .planned]).plannedSetsLeft == 1)
        #expect(state([.done, .done, .done]).plannedSetsLeft == 0)
    }
}
