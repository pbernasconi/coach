import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// `SessionHealthRepository`: the saved Apple Health workout's id on a session (made-up ids).
@Suite struct SessionHealthTests {
    private static let workoutID = UUID(uuid: (0xEE, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1))

    @Test func storingTheIDIsOneWriteWithOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        try await store.sessions.setHealthWorkoutID(Self.workoutID, forSession: session.id)
        let saved = try await store.sessions.healthSession(id: session.id)
        #expect(saved?.healthWorkoutID == Self.workoutID)
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity) == [.session])
        #expect(entries.map(\.op) == [.update])
        #expect(entries.first?.payload.contains(Self.workoutID.uuidString) == true)
    }

    @Test func aRemovedSessionStillReadsAndClears() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        try await store.sessions.setHealthWorkoutID(Self.workoutID, forSession: session.id)
        _ = try await store.sessions.reschedule(session.id, .remove)
        #expect(try await store.sessions.healthSession(id: session.id)?.healthWorkoutID == Self.workoutID)
        try await store.sessions.setHealthWorkoutID(nil, forSession: session.id)
        let cleared = try await store.sessions.healthSession(id: session.id)
        #expect(cleared?.healthWorkoutID == nil)
        #expect(cleared?.deletedAt != nil)
    }

    @Test func finishingAndUndoingARemoveKeepTheID() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        try await store.sessions.setHealthWorkoutID(Self.workoutID, forSession: session.id)
        _ = try await store.sessions.finish(sessionID: session.id)
        let undo = try await store.sessions.reschedule(session.id, .remove)
        try await store.sessions.undo(undo)
        #expect(try await store.sessions.healthSession(id: session.id)?.healthWorkoutID == Self.workoutID)
    }

    @Test func anUnknownSessionReadsNilAndCannotBeSet() async throws {
        let store = try TestStore.make()
        #expect(try await store.sessions.healthSession(id: Self.workoutID) == nil)
        await #expect(throws: AppError.self) {
            try await store.sessions.setHealthWorkoutID(Self.workoutID, forSession: Self.workoutID)
        }
    }
}
