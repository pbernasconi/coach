import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// `exercise.catalogID` travels in push payloads and is applied from pulls.
@Suite struct CatalogIDSyncTests {
    private static let entry = CatalogExercise(
        id: "9002",
        name: "Made-Up Row",
        category: "back",
        bodyPart: "back",
        equipment: "cable",
        target: "upper back",
        secondary: [],
        muscleGroup: "back",
        steps: ["Row."],
        imagePath: "images/9002-x.jpg",
        gifPath: "videos/9002-x.gif"
    )

    @Test func pushCarriesCatalogIDOnTheWire() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.create(fromCatalog: Self.entry)
        let entry = try #require(try await store.outbox.pending(limit: 10).first)
        let change = try PushChange(entry: entry)
        #expect(change.payload["catalogID"] == .string("9002"))
    }

    @Test func pullRoundTripsCatalogID() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        let written = try await remote.store.exercises.create(fromCatalog: Self.entry)
        harness.transport.queuePull(PullResponse(changes: try await remote.takeChanges(), cursor: "1", hasMore: false))
        _ = await harness.engine.syncNow()
        let local = try await harness.store.database.writer.read { db in
            try ExerciseRow.fetchOne(db, key: written.id)?.exercise
        }
        #expect(local == written)
        #expect(local?.catalogID == "9002")
    }

    @Test func aSeedRowPulledWithoutTheColumnKeepsItsCatalogID() async throws {
        let harness = try SyncHarness()
        let remote = try RemoteDevice()
        _ = try await remote.store.exercises.installLibrary()
        var changes = try await remote.takeChanges()
        changes = changes.map { change in
            var old = change
            old.payload["catalogID"] = nil  // as written by a build before v3
            return old
        }
        harness.transport.queuePull(PullResponse(changes: changes, cursor: "1", hasMore: false))
        _ = await harness.engine.syncNow()
        let squat = try await harness.store.database.writer.read { db in
            try ExerciseRow.fetchOne(db, key: ExerciseLibrary.seedID(1))?.exercise
        }
        #expect(squat?.catalogID == "0043")
    }
}
