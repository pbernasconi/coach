import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// Saving finished workouts to Apple Health over the real store and a Health store in memory (made-up sessions).
@MainActor
@Suite struct HealthRecorderTests {
    let store: TestStore
    let health: FakeHealthWorkoutStore
    let settings = InMemoryHealthSettings()

    init() throws {
        store = try TestStore.make()
        health = FakeHealthWorkoutStore(authorization: .authorized)
    }

    var recorder: HealthRecorder {
        HealthRecorder(store: health, sessions: store.sessions, settings: settings)
    }

    /// A session with one set logged at the start, finished 50 minutes later.
    func finishedSession(logging: Bool = true) async throws -> SessionRecord {
        let session = try await store.sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: .kg,
            templateID: nil
        )
        let slot = try await store.sessions.addExercise(ExerciseSlot(exercise: Fixtures.squat), to: session.id)
        let set = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        if logging { _ = try await store.sets.log(setID: set.id) }
        store.now.advance(seconds: 50 * 60)
        return try await store.sessions.finish(sessionID: session.id)
    }

    func healthID(_ id: UUID) async throws -> UUID? {
        try await store.sessions.healthSession(id: id)?.healthWorkoutID
    }

    @Test func aFinishedSessionIsSavedOnceAsAStrengthWorkoutFromStartToFinish() async throws {
        let session = try await finishedSession()
        let recorder = recorder

        await recorder.sessionFinished(session.id)
        await recorder.sessionFinished(session.id)
        await recorder.sessionRestored(session.id)

        #expect(health.saved.count == 1)
        let (workoutID, workout) = try #require(health.saved.first)
        #expect(
            workout
                == HealthWorkout(
                    sessionID: session.id,
                    title: "Lower A",
                    start: ManualNow.start,
                    end: ManualNow.start.addingTimeInterval(3_000)
                )
        )
        #expect(try await healthID(session.id) == workoutID)
    }

    @Test func finishingNeverAsksForPermission() async throws {
        health.authorizationValue = .notDetermined
        let session = try await finishedSession()

        await recorder.sessionFinished(session.id)

        #expect(health.requestCount == 0)
        #expect(health.saved.isEmpty)
        #expect(recorder.status() == .notAsked)
    }

    @Test func allowAsksOnceThenSavesTheSession() async throws {
        health.authorizationValue = .notDetermined
        let session = try await finishedSession()

        let status = await recorder.allow(savingSession: session.id)

        #expect(status == .on)
        #expect(health.requestCount == 1)
        #expect(health.saved.count == 1)
        #expect(try await healthID(session.id) != nil)
    }

    @Test func aRefusalSavesNothing() async throws {
        health.authorizationValue = .notDetermined
        health.answer = .denied
        let session = try await finishedSession()

        let status = await recorder.allow(savingSession: session.id)

        #expect(status == .denied)
        #expect(health.saved.isEmpty)
        #expect(try await healthID(session.id) == nil)
    }

    @Test func turnedOffSavesNothingAndTurningOnAsksOnlyWhenNeverAsked() async throws {
        settings.savesWorkouts = false
        let session = try await finishedSession()
        let recorder = recorder

        await recorder.sessionFinished(session.id)
        #expect(health.saved.isEmpty)
        #expect(recorder.status() == .off)

        #expect(await recorder.setEnabled(true) == .on)
        #expect(health.requestCount == 0)
        #expect(settings.savesWorkouts)
    }

    @Test func aDiscardDeletesLiftsWorkoutAndUndoSavesItAgain() async throws {
        let session = try await finishedSession()
        let recorder = recorder
        await recorder.sessionFinished(session.id)
        let first = try #require(try await healthID(session.id))

        let undo = try await store.sessions.reschedule(session.id, .remove)
        await recorder.sessionRemoved(session.id)
        #expect(health.deleted == [first])
        #expect(try await healthID(session.id) == nil)

        try await store.sessions.undo(undo)
        await recorder.sessionRestored(session.id)
        let second = try #require(try await healthID(session.id))
        #expect(second != first)
        #expect(health.saved.keys.sorted { $0.uuidString < $1.uuidString } == [second])
    }

    @Test func aSessionWithoutAWorkoutInHealthDeletesNothing() async throws {
        let session = try await finishedSession()
        _ = try await store.sessions.reschedule(session.id, .remove)

        await recorder.sessionRemoved(session.id)

        #expect(health.deleted.isEmpty)
    }

    @Test func aSessionFinishedWithNothingLoggedHasNoStartAndIsNotSaved() async throws {
        let session = try await finishedSession(logging: false)

        await recorder.sessionFinished(session.id)

        #expect(health.saved.isEmpty)
    }

    @Test func aFailedSaveLeavesTheSessionUnlinked() async throws {
        health.saveError = AppError(.unknown)
        let session = try await finishedSession()

        await recorder.sessionFinished(session.id)

        #expect(try await healthID(session.id) == nil)
    }

    @Test func aDeviceWithoutHealthIsUnavailableWhateverTheSetting() {
        health.authorizationValue = .unavailable
        settings.savesWorkouts = false
        #expect(recorder.status() == .unavailable)
    }
}
