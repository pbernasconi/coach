import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// The Workout screen's edits: remove with undo, reorder and finish (TEST-5).
@Suite struct SessionEditingTests {
    @Test func aRemovedExerciseComesBack() async throws {
        let store = try TestStore.make()
        let (session, slot) = try await store.sessionWithSquat()
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        #expect(await stream.next()??.items.count == 1)
        try await store.sessions.removeExercise(id: slot.id)
        #expect(await stream.next()??.items.isEmpty == true)
        try await store.sessions.restoreExercise(id: slot.id)
        #expect(await stream.next()??.items.map(\.id) == [slot.id])
        #expect(try await store.pendingOutbox().map(\.op) == [.delete, .update])
    }

    @Test func reorderMovesTheExercises() async throws {
        let store = try TestStore.make()
        let (session, squat) = try await store.sessionWithSquat()
        let bench = try await store.sessions.addExercise(ExerciseSlot(exercise: Fixtures.dumbbellBench), to: session.id)
        try await store.drainOutbox()
        try await store.sessions.reorderExercises(in: session.id, ids: [bench.id, squat.id])
        #expect(try await store.pendingOutbox().map(\.entity) == [.sessionExercise, .sessionExercise])
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        #expect(await stream.next()??.items.map(\.id) == [bench.id, squat.id])
    }

    @Test func finishStampsTheTimesAndLogsNothing() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let other = try await store.sets.addSet(to: set.sessionExerciseID, kind: .working, target: Fixtures.fiveAt100)
        _ = try await store.sets.log(setID: set.id)
        store.now.advance(seconds: 1_800)
        let session = try #require(try await store.database.writer.read { db in try SessionRecord.fetchAll(db).first })
        try await store.drainOutbox()

        let finished = try await store.sessions.finish(sessionID: session.id)
        #expect(finished.startedAt == ManualNow.start)
        #expect(finished.finishedAt == ManualNow.start.addingTimeInterval(1_800))
        #expect(try await store.pendingOutbox().map(\.entity) == [.session])
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        let detail = try #require(await stream.next() ?? nil)
        #expect(detail.items.flatMap(\.sets).first { $0.id == other.id }?.status == .planned)
    }

    @Test func finishingARemovedSessionThrows() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.reschedule(session.id, .remove)
        await #expect(throws: AppError(.notFound, detail: "session \(session.id)")) {
            try await store.sessions.finish(sessionID: session.id)
        }
    }
}
