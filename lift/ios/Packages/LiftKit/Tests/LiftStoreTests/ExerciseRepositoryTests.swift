import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct ExerciseRepositoryTests {
    @Test func installLibraryInsertsEverySeedOnce() async throws {
        let store = try TestStore.make()
        #expect(try await store.exercises.installLibrary() == ExerciseLibrary.seed.count)
        #expect(try await store.pendingOutbox().count == ExerciseLibrary.seed.count)
        #expect(try await store.exercises.installLibrary() == 0)
        #expect(try await store.pendingOutbox().count == ExerciseLibrary.seed.count)
    }

    @Test func installLibraryKeepsARemovedSeedRemoved() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        try await store.exercises.remove(id: Fixtures.squat.id)
        #expect(try await store.exercises.installLibrary() == 0)
        var stream = store.exercises.observeExercises().makeAsyncIterator()
        let names = await stream.next()?.map(\.name) ?? []
        #expect(!names.contains(Fixtures.squat.name))
        #expect(names.count == ExerciseLibrary.seed.count - 1)
    }

    @Test func createWritesTheRowAndExactlyOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let exercise = try await store.exercises.create(
            name: "Sled push",
            equipment: .other,
            loadMode: .total,
            primary: [.quads],
            secondary: [.calves]
        )
        #expect(exercise.createdAt == ManualNow.start)
        let entries = try await store.pendingOutbox()
        #expect(entries.count == 1)
        #expect(entries.first?.entity == .exercise)
        #expect(entries.first?.op == .insert)
        #expect(entries.first?.rowID == exercise.id)
        #expect(entries.first?.payload.contains("\"name\":\"Sled push\"") == true)
        #expect(entries.first?.payload.contains("\"id\":\"\(exercise.id.uuidString)\"") == true)
    }

    @Test func updateKeepsCreatedAtAndBumpsUpdatedAt() async throws {
        let store = try TestStore.make()
        var exercise = try await store.exercises.create(
            name: "Sled push",
            equipment: .other,
            loadMode: .total,
            primary: [.quads],
            secondary: []
        )
        store.now.advance(seconds: 60)
        exercise.name = "Sled drag"
        exercise.loadMode = .bodyweight(added: .kg(10))
        let saved = try await store.exercises.update(exercise)
        #expect(saved.name == "Sled drag")
        #expect(saved.loadMode == .bodyweight(added: .kg(10)))
        #expect(saved.createdAt == ManualNow.start)
        #expect(saved.updatedAt == ManualNow.start.addingTimeInterval(60))
        #expect(try await store.pendingOutbox().map(\.op) == [.insert, .update])
    }

    @Test func removeHidesTheRowAndRestoreBringsItBack() async throws {
        let store = try TestStore.make()
        let exercise = try await store.exercises.create(
            name: "Sled push",
            equipment: .other,
            loadMode: .total,
            primary: [.quads],
            secondary: []
        )
        var stream = store.exercises.observeExercises().makeAsyncIterator()
        #expect(await stream.next()?.map(\.id) == [exercise.id])
        try await store.exercises.remove(id: exercise.id)
        #expect(await stream.next()?.isEmpty == true)
        try await store.exercises.restore(id: exercise.id)
        #expect(await stream.next()?.map(\.id) == [exercise.id])
        #expect(try await store.pendingOutbox().map(\.op) == [.insert, .delete, .update])
    }

    @Test func removingAMissingExerciseThrowsNotFound() async throws {
        let store = try TestStore.make()
        await #expect(throws: AppError(.notFound, detail: "exercise \(Fixtures.squat.id)")) {
            try await store.exercises.remove(id: Fixtures.squat.id)
        }
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func libraryRowsRoundTripThroughTheTable() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        var stream = store.exercises.observeExercises().makeAsyncIterator()
        let stored = await stream.next() ?? []
        #expect(Set(stored) == Set(ExerciseLibrary.seed))
    }
}
