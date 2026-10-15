import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// `importTapped` and `stopTapped`: the writes go through the real repositories of an in-memory store, so each row
/// reaches the outbox (DATA-3). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct ImportNotesWriteTests {
    private func reviewed(_ harness: ImportHarness, sets: (any SetRepository)? = nil) async -> ImportNotesViewModel {
        let vm = harness.viewModel(text: ImportHarness.note, sets: sets)
        await vm.send(.continueTapped)?.value
        return vm
    }

    @Test func importTappedWritesEveryIncludedWorkout() async throws {
        let harness = try await ImportHarness.make()
        let vm = await reviewed(harness)

        let task = vm.send(.importTapped)
        #expect(vm.state.step == .importing(ImportProgress(sessionTotal: 2, setTotal: 6)))
        #expect(vm.send(.importTapped) == nil)  // a double tap writes once
        await task?.value

        let tally = ImportTally(sessions: 2, sets: 6, loggedSets: 5, newExercises: 1)
        #expect(vm.state.outcome == ImportOutcome(ending: .finished, tally: tally, sessionTotal: 2))
        let stored = await harness.storedSessions()
        #expect(stored.map(\.session.title) == ["Workout A", "Workout B"])
        #expect(stored.map(\.session.day) == [ImportHarness.dayA, ImportHarness.dayB])
        #expect(stored.allSatisfy { $0.session.unitsAtLog == .kg })
        #expect(try await !harness.store.outbox.pending(limit: 100).isEmpty)
    }

    @Test func importTappedLogsDoneSetsWithTheirValuesAndSkipsTheRest() async throws {
        let harness = try await ImportHarness.make()
        let vm = await reviewed(harness)

        await vm.send(.importTapped)?.value

        let squat = try #require(await harness.storedSessions().first?.items.first)
        #expect(squat.exercise.exerciseID == ExerciseLibrary.seedID(1))
        #expect(squat.exercise.displayName == "squat")
        #expect(squat.sets.map(\.status) == [.done, .done, .skipped])
        #expect(squat.sets.map(\.actualReps) == [5, 5, nil])
        #expect(squat.sets.map(\.actualWeight) == [.kg(60), .kg(62.5), nil])
        #expect(squat.sets.map(\.target.weight) == [.kg(60), .kg(60), .kg(60)])
    }

    @Test func importTappedCreatesEachUnknownExerciseOnce() async throws {
        let harness = try await ImportHarness.make()
        let vm = await reviewed(harness)

        await vm.send(.importTapped)?.value

        let created = await harness.storedExercises().filter { $0.name == "Landmine rotation" }
        #expect(created.count == 1)
        let landmine = try #require(await harness.storedSessions().first?.items.last)
        #expect(landmine.exercise.exerciseID == created.first?.id)
        #expect(landmine.exercise.displayName == "Landmine rotation")
    }

    @Test func importTappedLeavesExcludedWorkoutsOut() async throws {
        let harness = try await ImportHarness.make()
        let vm = await reviewed(harness)
        let first = try #require(vm.state.review?.candidates.first?.id)
        vm.send(.sessionToggled(first))

        await vm.send(.importTapped)?.value

        #expect(vm.state.outcome?.tally == ImportTally(sessions: 1, sets: 2, loggedSets: 2))
        #expect(await harness.storedSessions().map(\.session.title) == ["Workout B"])
        #expect(await harness.storedExercises().contains { $0.name == "Landmine rotation" } == false)
    }

    @Test func stopTappedEndsTheImportBeforeItsNextWrite() async throws {
        let harness = try await ImportHarness.make()
        let vm = await reviewed(harness)

        let task = vm.send(.importTapped)
        #expect(vm.send(.stopTapped) == nil)
        guard case .importing(let progress) = vm.state.step else {
            Issue.record("Expected the importing step, got \(vm.state.step)")
            return
        }
        #expect(progress.isStopping)
        await task?.value

        #expect(vm.state.outcome == ImportOutcome(ending: .cancelled, tally: ImportTally(), sessionTotal: 2))
        #expect(await harness.storedSessions().isEmpty)
    }

    @Test func aFailedWriteReportsExactlyWhatWasSaved() async throws {
        let harness = try await ImportHarness.make()
        // The fifth set is the first one of Workout B.
        let failing = FailingSetRepository(base: harness.store.sets, failingAddSet: 5, error: AppError(.server))
        let vm = await reviewed(harness, sets: failing)

        await vm.send(.importTapped)?.value

        let outcome = try #require(vm.state.outcome)
        let tally = ImportTally(sessions: 1, sets: 4, loggedSets: 3, newExercises: 1, incompleteSession: "Workout B")
        #expect(outcome == ImportOutcome(ending: .failed(.server), tally: tally, sessionTotal: 2))
        let stored = await harness.storedSessions()
        #expect(stored.map(\.session.title) == ["Workout A", "Workout B"])
        #expect(stored.last?.items.flatMap(\.sets).isEmpty == true)
        let detail = ImportOutcomeCopy.detail(outcome)
        #expect(detail.contains("1 of 2 workouts and 4 sets were saved."))
        #expect(detail.contains("Workout B was saved only in part."))
    }

    @Test func reimportingMarksWhatWasWrittenAsAlreadyImported() async throws {
        let harness = try await ImportHarness.make()
        await reviewed(harness).send(.importTapped)?.value

        let again = await reviewed(harness)

        #expect(again.state.review?.candidates.map(\.isDuplicate) == [true, true])
        #expect(again.state.review?.included.isEmpty == true)
        #expect(again.send(.importTapped) == nil)
    }
}
