import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// v10 (DATA-5, TEST-5): the workout timeline. Each moment is one row with one outbox entry, its stamps and ids cross
/// to the wire like every synced row, and a pulled event applies even before its session. Made-up values only (TEST-8).
@Suite struct WorkoutEventTests {
    @Test func v10AddsTheWorkoutEventTableAndKeepsV9Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v9SessionPause)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
                    VALUES (x'0123456789ABCDEF0123456789ABCDEF', '2026-03-02', 'Test', 'kg', '2026-03-02 09:00:00.000',
                            '2026-03-02 09:00:00.000')
                    """
            )
        }
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v10WorkoutEvents)
        try queue.read { db in
            let columns = Set(try db.columns(in: "workoutEvent").map(\.name))
            #expect(
                columns == [
                    "id", "sessionID", "kind", "occurredAt", "setID", "seconds", "source", "createdAt", "updatedAt",
                    "deletedAt",
                ]
            )
            #expect(try db.indexes(on: "workoutEvent").map(\.name).contains("workoutEvent_on_session"))
            #expect(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM session") == 1)
        }
    }

    @Test func recordingAMomentStoresItWithOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let events = LiveWorkoutEventRepository(database: store.database, now: { store.now() }, makeID: { store.ids.next() })
        let session = IDSequence.id(7, prefix: 0xB0)
        let set = IDSequence.id(8, prefix: 0xB0)
        let restStart = ManualNow.start.addingTimeInterval(-2)

        try await events.record(
            WorkoutEvent(sessionID: session, kind: .restStarted, occurredAt: restStart, setID: set, seconds: 180)
        )
        try await events.record(
            WorkoutEvent(sessionID: session, kind: .restSkipped, occurredAt: ManualNow.start, seconds: 2, source: .lockScreen)
        )

        let stored = try await events.events(sessionID: session)
        #expect(stored.map(\.kind) == ["restStarted", "restSkipped"])
        #expect(stored[0].occurredAt == restStart)
        #expect(stored[0].setID == set)
        #expect(stored[0].seconds == 180)
        #expect(stored[1].source == "lockScreen")

        let outbox = try await store.outbox.pending(limit: 10)
        #expect(outbox.map(\.entity) == [.workoutEvent, .workoutEvent])
        #expect(outbox.map(\.op) == [.insert, .insert])
        let wire = try SyncPayload.wireObject(outboxPayload: outbox[0].payload)
        #expect(wire["setID"]?.stringValue == set.uuidString)
        #expect(wire["occurredAt"]?.stringValue?.hasSuffix("Z") == true)
    }

    @Test func aPulledEventAppliesBeforeItsSession() async throws {
        let store = try TestStore.make()
        let sync = LiveSyncStateRepository(database: store.database, makeID: { store.ids.next() })
        let id = IDSequence.id(9, prefix: 0xB0)
        let payload: [String: JSONValue] = [
            "id": .string(id.uuidString),
            "sessionID": .string(IDSequence.id(10, prefix: 0xB0).uuidString),
            "kind": .string("aKindFromANewerBuild"),
            "occurredAt": .string("2026-03-02T09:00:00.000Z"),
            "setID": .null,
            "seconds": .null,
            "source": .string("app"),
            "createdAt": .string("2026-03-02T09:00:00.000Z"),
            "updatedAt": .string("2026-03-02T09:00:00.000Z"),
            "deletedAt": .null,
        ]

        let result = try await sync.apply(
            PulledPage(changes: [RemoteChange(entity: .workoutEvent, rowID: id, payload: payload)], cursor: "1", isFinal: true)
        )

        #expect(result.applied == 1)
        #expect(try await store.pendingOutbox().isEmpty)  // pulled rows never go back out
    }
}
