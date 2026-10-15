import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct OutboxTests {
    @Test func payloadIsTheRowColumnForColumn() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        _ = try await store.sets.log(setID: set.id)
        let payload = try #require(try await store.pendingOutbox().first?.payload)
        let object = try #require(try JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any])
        #expect(object["id"] as? String == set.id.uuidString)
        #expect(object["sessionExerciseID"] as? String == set.sessionExerciseID.uuidString)
        #expect(object["status"] as? String == "done")
        #expect(object["unit"] as? String == "kg")
        #expect(object["loadMode"] as? String == "total")
        #expect(object["actualReps"] as? Int == 5)
        #expect(object["targetWeight"] as? Double == 100)
        #expect(object["deletedAt"] is NSNull)
    }

    @Test func pendingIsOldestFirstAndAcknowledgeRemoves() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        _ = try await store.sets.saveValues(setID: set.id, reps: 5, weight: .kg(100))
        _ = try await store.sets.log(setID: set.id)
        let entries = try await store.pendingOutbox()
        #expect(entries.count == 2)
        #expect(entries.first?.payload.contains("\"status\":\"planned\"") == true)
        try await store.outbox.acknowledge([try #require(entries.first?.id)])
        #expect(try await store.pendingOutbox().map(\.id) == [try #require(entries.last?.id)])
        try await store.outbox.acknowledge([try #require(entries.first?.id)])  // a repeated ack is harmless
        #expect(try await store.pendingOutbox().count == 1)
    }

    @Test func idempotencyKeysAreUniqueSoARetryCannotDuplicate() async throws {
        let store = try TestStore.make()
        _ = try await store.plannedSet()
        _ = try await store.sets.addSet(to: try await store.sessionWithSquat().1.id, kind: .warmUp, target: .none)
        let entry = try #require(try await store.pendingOutbox().first)
        let retry = OutboxEntry(
            id: store.ids.next(),
            entity: entry.entity,
            rowID: entry.rowID,
            op: entry.op,
            payload: entry.payload,
            idempotencyKey: entry.idempotencyKey,
            createdAt: entry.createdAt
        )
        await #expect(throws: DatabaseError.self) {
            try await store.database.writer.write { db in try retry.insert(db) }
        }
        #expect(try await store.pendingOutbox().count == 1)
        #expect(Set(try await store.pendingOutbox().map(\.idempotencyKey)).count == 1)
    }

    @Test func pendingCountFollowsWritesAndAcks() async throws {
        let store = try TestStore.make()
        var stream = store.outbox.observePendingCount().makeAsyncIterator()
        #expect(await stream.next() == 0)
        _ = try await store.sessions.createSession(on: Fixtures.monday, title: "Lower A", unit: .kg, templateID: nil)
        #expect(await stream.next() == 1)
        try await store.drainOutbox()
        #expect(await stream.next() == 0)
    }

    @Test func pendingEntriesComeInWriteOrderNotIDOrder() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Full")
        let first = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        let second = try await store.templates.addExercise(Fixtures.dumbbellBench, to: template.id)
        try await store.drainOutbox()
        // The later row (higher id) is written first.
        try await store.templates.reorderExercises(in: template.id, ids: [second.id, first.id])
        #expect(try await store.pendingOutbox().map(\.rowID) == [second.id, first.id])
    }
}
