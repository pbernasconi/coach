import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// Row stamps keep every millisecond between the database and the wire. Found by the end-to-end suite: about
/// half of all stamps lost a millisecond on push (".191" went out as ".190"), so two devices never held identical
/// rows and a device's own echo looked older than its local row.
@Suite struct StampRoundTripTests {
    @Test func everyStoredMillisecondPushesUnchanged() throws {
        for millisecond in 0..<1000 {
            let fraction = pad(millisecond)
            let stored = "2026-03-02 09:00:14.\(fraction)"
            let wire = try SyncPayload.wireObject(outboxPayload: #"{"updatedAt":"\#(stored)"}"#)
            #expect(wire["updatedAt"] == .string("2026-03-02T09:00:14.\(fraction)Z"))
        }
    }

    @Test func everyWireMillisecondIsStoredUnchanged() throws {
        for millisecond in 0..<1000 {
            let fraction = pad(millisecond)
            let row = try SyncPayload.row(from: ["updatedAt": .string("2026-03-02T09:00:14.\(fraction)Z")])
            #expect(row["updatedAt"] as String? == "2026-03-02 09:00:14.\(fraction)")
        }
    }

    @Test func otherWireFormsAreNormalisedToTheMillisecond() throws {
        let cases: [(wire: String, stored: String)] = [
            ("2026-03-02T10:00:14.191+01:00", "2026-03-02 09:00:14.191"),
            ("2026-03-02T09:00:14Z", "2026-03-02 09:00:14.000"),
            ("2026-03-02T09:00:14.1919Z", "2026-03-02 09:00:14.191"),
            ("2026-03-02 09:00:14.191", "2026-03-02 09:00:14.191"),  // GRDB text pushed by an older client
        ]
        for (wire, stored) in cases {
            let row = try SyncPayload.row(from: ["completedAt": .string(wire)])
            #expect(row["completedAt"] as String? == stored, "\(wire)")
        }
        #expect(throws: (any Error).self) { try SyncPayload.row(from: ["updatedAt": .string("yesterday")]) }
    }

    @Test func datesFormatRoundedToTheMillisecond() {
        let date = Date(timeIntervalSince1970: 1_772_442_014.190_999_9)
        #expect(SyncPayload.wireDate(date) == "2026-03-02T09:00:14.191Z")
        #expect(SyncPayload.wireDate(Date(timeIntervalSince1970: 1_772_442_014.999_6)) == "2026-03-02T09:00:15.000Z")
        #expect(SyncPayload.wireDate(Date(timeIntervalSince1970: -0.25)) == "1969-12-31T23:59:59.750Z")
    }

    @Test func clockStampsWithFloatingPointErrorRoundTripThroughPushAndPull() async throws {
        let device = try TestStore(database: .inMemory(), ids: IDSequence(), now: ManualNow(ManualNow.start + 0.123))
        let other = try TestStore(database: .inMemory(), ids: IDSequence(prefix: 0xAA), now: ManualNow())
        var setIDs: [UUID] = []
        let set = try await device.writeLocalSet()
        setIDs.append(set.id)
        for _ in 0..<50 {
            device.now.advance(seconds: 0.001)  // accumulates binary rounding error, like a real clock
            setIDs.append(
                try await device.sets.addSet(to: set.sessionExerciseID, kind: .working, target: Fixtures.fiveAt100).id
            )
        }
        let changes = try await device.outbox.pending(limit: 100).map { entry in
            RemoteChange(entity: entry.entity, rowID: entry.rowID, payload: try PushChange(entry: entry).payload)
        }
        let state = LiveSyncStateRepository(database: other.database) { UUID() }
        _ = try await state.apply(PulledPage(changes: changes, cursor: "1", isFinal: true))
        for id in setIDs {
            let sql = "SELECT createdAt || ' ' || updatedAt FROM workoutSet WHERE id = ?"
            let mine = try await device.database.writer.read { db in try String.fetchOne(db, sql: sql, arguments: [id])
            }
            let theirs = try await other.database.writer.read { db in try String.fetchOne(db, sql: sql, arguments: [id])
            }
            #expect(mine != nil)
            #expect(mine == theirs)
        }
    }

    private func pad(_ millisecond: Int) -> String {
        String(repeating: "0", count: 3 - String(millisecond).count) + String(millisecond)
    }
}
