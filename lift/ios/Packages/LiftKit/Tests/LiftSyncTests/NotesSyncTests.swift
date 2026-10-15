import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// The notes an import keeps travel in push payloads and are applied from pulls: `session.note` and `warmUpNote`,
/// `sessionExercise.nextTimeHintValue`/`Unit`, and `workoutSet.note` with its `completedAt` (SYNC.md: one key per
/// column). Made-up values only (TEST-8).
@Suite struct NotesSyncTests {
    private static let noon = ManualNow.start.addingTimeInterval(-3 * 86_400)

    /// A session with notes, an exercise with a next-time weight and a done set with a note.
    private func writeNotes(_ store: TestStore) async throws -> (SessionRecord, SessionExerciseRecord, SetRecord) {
        let session = try await store.sessions.createImportedSession(
            Session(
                id: UUID(),
                date: Fixtures.monday,
                title: "Push",
                warmUpNote: "Rower",
                note: "Felt strong",
                unitsAtLog: .kg,
                createdAt: .distantPast,
                updatedAt: .distantPast
            )
        )
        var slot = ExerciseSlot(exercise: Fixtures.dumbbellBench)
        slot.nextTimeHint = .kg(22)
        let exercise = try await store.sessions.addExercise(slot, to: session.id)
        let imported = LoggedSet(id: UUID(), actual: SetActual(reps: 8, weight: .kg(20)), note: "paused")
        let set = try await store.sets.addImported(imported, to: exercise.id, completedAt: Self.noon)
        return (session, exercise, set)
    }

    @Test func pushCarriesEveryNoteOnTheWire() async throws {
        let store = try TestStore.make()
        _ = try await writeNotes(store)
        let changes = try await store.outbox.pending(limit: 10).map(PushChange.init(entry:))
        #expect(changes.map(\.entity) == [.session, .sessionExercise, .set])
        let session = try #require(changes.first?.payload)
        #expect(session["note"] == .string("Felt strong"))
        #expect(session["warmUpNote"] == .string("Rower"))
        let exercise = try #require(changes.dropFirst().first?.payload)
        #expect(exercise["nextTimeHintValue"] == .integer(22) || exercise["nextTimeHintValue"] == .double(22))
        #expect(exercise["nextTimeHintUnit"] == .string("kg"))
        let set = try #require(changes.last?.payload)
        #expect(set["note"] == .string("paused"))
        #expect(set["status"] == .string("done"))
        #expect(set["completedAt"] == .string(SyncPayload.wireDate(Self.noon)))
    }

    @Test func pullAppliesEveryNote() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let (session, exercise, set) = try await writeNotes(remote.store)
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "3", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in
            (
                try SessionRecord.fetchOne(db, key: session.id),
                try SessionExerciseRecord.fetchOne(db, key: exercise.id),
                try SetRecord.fetchOne(db, key: set.id)
            )
        }
        #expect(local.0?.note == "Felt strong")
        #expect(local.0?.warmUpNote == "Rower")
        #expect(local.1?.nextTimeHint == .kg(22))
        #expect(local.2?.note == "paused")
        #expect(local.2?.completedAt == Self.noon)
        #expect(local.2 == set)
    }
}
