import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// Edits are stamped after the version they replace, even when this device's clock is behind it, so last-writer-
/// wins by `updatedAt` keeps the edit made last (SYNC.md). Found by the end-to-end suite: a phone whose clock ran
/// behind a pulled row lost its own later edit on the server but kept it locally, and the devices never agreed.
@Suite struct EditStampTests {
    @Test func anEditOfARowStampedAheadOfThisClockIsStampedJustPastIt() async throws {
        let store = try TestStore.make()
        let set = try await store.writeAheadSet(byHours: 2)
        let edited = try await store.sets.saveValues(setID: set.id, reps: 3, weight: nil)
        let stored = try #require(try await store.storedUpdatedAt(set.id))
        #expect(stored == "2026-03-02 11:00:00.001")
        #expect(edited.updatedAt > set.updatedAt)
        let payload = try #require(try await store.outbox.pending(limit: 10).last?.payload)
        #expect(payload.contains(#""updatedAt":"2026-03-02 11:00:00.001""#))
    }

    @Test func twoEditsInOneMillisecondAreStillOrdered() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        _ = try await store.sets.saveValues(setID: set.id, reps: 4, weight: nil)
        _ = try await store.sets.saveValues(setID: set.id, reps: 5, weight: nil)
        #expect(try await store.storedUpdatedAt(set.id) == "2026-03-02 09:00:00.002")
    }

    @Test func anEditWithTheClockAheadUsesTheClock() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        store.now.advance(seconds: 61.5)
        let edited = try await store.sets.saveValues(setID: set.id, reps: 4, weight: nil)
        #expect(edited.updatedAt == store.now())
        #expect(try await store.storedUpdatedAt(set.id) == "2026-03-02 09:01:01.500")
    }

    @Test func multiRowWritesStampPastTheRowToo() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        let first = try await store.templates.addExercise(ExerciseLibrary.seed[0], to: template.id)
        let second = try await store.templates.addExercise(ExerciseLibrary.seed[1], to: template.id)
        let ahead = ManualNow.start.addingTimeInterval(3600)
        try await store.database.writer.write { db in
            try db.execute(sql: "UPDATE templateExercise SET updatedAt = ?", arguments: [ahead])
        }
        try await store.templates.reorderExercises(in: template.id, ids: [second.id, first.id])
        let stamps = try await store.database.writer.read { db in
            try String.fetchAll(db, sql: "SELECT updatedAt FROM templateExercise ORDER BY position")
        }
        #expect(stamps == ["2026-03-02 10:00:00.001", "2026-03-02 10:00:00.001"])
    }

    @Test func stampRule() {
        let previous = Date(timeIntervalSince1970: 1_772_442_014.191)
        #expect(StoreWriter.stamp(after: previous, now: previous + 5) == previous + 5)
        let bumped = StoreWriter.stamp(after: previous, now: previous - 60)
        #expect(bumped.databaseValue == "2026-03-02 09:00:14.192".databaseValue)
        #expect(StoreWriter.stamp(after: previous, now: previous).databaseValue == bumped.databaseValue)
        let sameMillisecond = previous + 0.0004
        #expect(StoreWriter.stamp(after: previous, now: sameMillisecond).databaseValue == bumped.databaseValue)
    }
}

extension TestStore {
    /// A local set whose row (as if pulled from a device with a faster clock) is stamped `hours` ahead of this clock.
    fileprivate func writeAheadSet(byHours hours: Int) async throws -> SetRecord {
        let set = try await plannedSet()
        let ahead = ManualNow.start.addingTimeInterval(TimeInterval(hours * 3600))
        try await database.writer.write { db in
            try db.execute(sql: "UPDATE workoutSet SET updatedAt = ? WHERE id = ?", arguments: [ahead, set.id])
        }
        return try await database.writer.read { db in try SetRecord.find(db, key: set.id) }
    }

    /// A kg session with one planned squat set, all stamped `ManualNow.start`.
    fileprivate func plannedSet() async throws -> SetRecord {
        let (_, slot) = try await sessionWithSquat()
        return try await sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
    }

    fileprivate func storedUpdatedAt(_ id: UUID) async throws -> String? {
        try await database.writer.read { db in
            try String.fetchOne(db, sql: "SELECT updatedAt FROM workoutSet WHERE id = ?", arguments: [id])
        }
    }
}
