import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// `create(fromCatalog:)` and `catalogID` on library rows.
@Suite struct CatalogExerciseRepositoryTests {
    private static let pressEntry = CatalogExercise(
        id: "9001",
        name: "Made-Up Dumbbell Press",
        category: "chest",
        bodyPart: "chest",
        equipment: "dumbbell",
        target: "pectorals",
        secondary: ["triceps", "shoulders", "chest"],
        muscleGroup: "chest",
        steps: ["Press."],
        imagePath: "images/9001-x.jpg",
        gifPath: "videos/9001-x.gif"
    )

    @Test func installLibrarySetsEverySeedCatalogID() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        let library = await store.exercises.observeExercises().first { _ in true } ?? []
        #expect(library.count == ExerciseLibrary.seed.count)
        #expect(library.allSatisfy { $0.catalogID != nil })
        #expect(library.first { $0.id == ExerciseLibrary.seedID(1) }?.catalogID == "0043")
        let entries = try await store.pendingOutbox()
        #expect(entries.allSatisfy { $0.payload.contains("\"catalogID\":\"") })
    }

    @Test func createFromCatalogMapsTheEntryAndWritesOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let exercise = try await store.exercises.create(fromCatalog: Self.pressEntry)
        #expect(exercise.name == "Made-Up Dumbbell Press")
        #expect(exercise.catalogID == "9001")
        #expect(exercise.equipment == .dumbbell)
        #expect(exercise.loadMode == .perHand)
        #expect(exercise.primary == [.chest])
        #expect(exercise.secondary == [.triceps, .shoulders])
        #expect(exercise.createdAt == ManualNow.start)
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.op) == [.insert])
        #expect(entries.first?.payload.contains("\"catalogID\":\"9001\"") == true)
        let stored = await store.exercises.observeExercises().first { _ in true } ?? []
        #expect(stored == [exercise])
    }

    @Test func createFromCatalogIsIdempotentPerCatalogID() async throws {
        let store = try TestStore.make()
        let first = try await store.exercises.create(fromCatalog: Self.pressEntry)
        store.now.advance(seconds: 60)
        let second = try await store.exercises.create(fromCatalog: Self.pressEntry)
        #expect(second == first)
        #expect(try await store.pendingOutbox().count == 1)
    }

    @Test func createFromCatalogReturnsTheSeedRowForASeedEntry() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        try await store.drainOutbox()
        let squatEntry = try #require(try ExerciseCatalog.bundled().entry(id: "0043"))
        let exercise = try await store.exercises.create(fromCatalog: squatEntry)
        #expect(exercise.id == ExerciseLibrary.seedID(1))
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func createFromCatalogRestoresARemovedRowAndUnarchives() async throws {
        let store = try TestStore.make()
        let first = try await store.exercises.create(fromCatalog: Self.pressEntry)
        store.now.advance(seconds: 60)
        try await store.exercises.remove(id: first.id)
        store.now.advance(seconds: 60)
        let restored = try await store.exercises.create(fromCatalog: Self.pressEntry)
        #expect(restored.id == first.id)
        #expect(restored.deletedAt == nil)
        #expect(restored.updatedAt == ManualNow.start.addingTimeInterval(120))
        var archived = restored
        archived.isArchived = true
        _ = try await store.exercises.update(archived)
        let unarchived = try await store.exercises.create(fromCatalog: Self.pressEntry)
        #expect(unarchived.isArchived == false)
        #expect(try await store.pendingOutbox().map(\.op) == [.insert, .delete, .update, .update, .update])
    }

    @Test func updateKeepsCatalogID() async throws {
        let store = try TestStore.make()
        var exercise = try await store.exercises.create(fromCatalog: Self.pressEntry)
        exercise.name = "Renamed press"
        let saved = try await store.exercises.update(exercise)
        #expect(saved.catalogID == "9001")
    }

    @Test func sessionItemsCarryTheLibraryExerciseCatalogID() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        let (session, _) = try await store.sessionWithSquat()
        let custom = try await store.exercises.create(
            name: "Sled push",
            equipment: .other,
            loadMode: .total,
            primary: [.quads],
            secondary: []
        )
        _ = try await store.sessions.addExercise(ExerciseSlot(exercise: custom), to: session.id)
        let detail = await store.sessions.observeSession(id: session.id).first { _ in true } ?? nil
        #expect(detail?.items.map(\.catalogID) == ["0043", nil])
    }
}
