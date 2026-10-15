import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct SetRepositoryTests {
    @Test func addSetStampsUnitAndLoadModeFromItsParents() async throws {
        let store = try TestStore.make()
        let (_, slot) = try await store.sessionWithSquat(unit: .lb)
        let set = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        #expect(set.unit == .lb)
        #expect(set.loadMode == .total)
        #expect(set.status == .planned)
        #expect(set.target.weight == Weight.kg(100).converted(to: .lb))
        #expect(try await store.pendingOutbox().map(\.entity) == [.set])
    }

    @Test func doneSavesValuesOnlyAndNeverLogs() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let saved = try await store.sets.saveValues(setID: set.id, reps: 4, weight: .kg(102.5))
        #expect(saved.actualReps == 4)
        #expect(saved.actualWeight == .kg(102.5))
        #expect(saved.status == .planned)
        #expect(saved.completedAt == nil)
        #expect(saved.loggedSet.actual == nil)
        #expect(!saved.loggedSet.isDone)
    }

    @Test func savedWeightIsConvertedIntoTheRowUnit() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet(unit: .lb)
        let saved = try await store.sets.saveValues(setID: set.id, reps: 5, weight: .kg(100))
        #expect(saved.actualWeight == Weight.kg(100).converted(to: .lb))
    }

    @Test func logIsOneWriteThatFillsMissingValuesFromTheTarget() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        store.now.advance(seconds: 90)
        let logged = try await store.sets.log(setID: set.id)
        #expect(logged.status == .done)
        #expect(logged.actualReps == 5)
        #expect(logged.actualWeight == .kg(100))
        #expect(logged.completedAt == ManualNow.start.addingTimeInterval(90))
        #expect(logged.loggedSet.isDone)
        #expect(try await store.pendingOutbox().map(\.op) == [.update])
    }

    @Test func logKeepsValuesSavedBeforeIt() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        _ = try await store.sets.saveValues(setID: set.id, reps: 3, weight: .kg(97.5))
        let logged = try await store.sets.log(setID: set.id)
        #expect(logged.actualReps == 3)
        #expect(logged.actualWeight == .kg(97.5))
        #expect(logged.target == Fixtures.fiveAt100)
    }

    @Test func unlogReturnsToPlannedAndKeepsValues() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        _ = try await store.sets.log(setID: set.id)
        let undone = try await store.sets.unlog(setID: set.id)
        #expect(undone.status == .planned)
        #expect(undone.completedAt == nil)
        #expect(undone.actualReps == 5)
    }

    @Test func skipMarksSkipped() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let skipped = try await store.sets.skip(setID: set.id)
        #expect(skipped.status == .skipped)
        #expect(skipped.loggedSet.isSkipped)
        #expect(!skipped.loggedSet.isDone)
    }

    @Test func everyWriteAppendsExactlyOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let writes: [(OutboxOp, () async throws -> Void)] = [
            (.update, { _ = try await store.sets.saveValues(setID: set.id, reps: 5, weight: .kg(100)) }),
            (.update, { _ = try await store.sets.log(setID: set.id) }),
            (.update, { _ = try await store.sets.unlog(setID: set.id) }),
            (.update, { _ = try await store.sets.skip(setID: set.id) }),
            (.delete, { try await store.sets.remove(setID: set.id) }),
            (.update, { try await store.sets.restore(setID: set.id) }),
        ]
        for (op, write) in writes {
            try await write()
            let entries = try await store.pendingOutbox()
            #expect(entries.map(\.op) == [op])
            #expect(entries.map(\.rowID) == [set.id])
            try await store.drainOutbox()
        }
    }

    @Test func removeHidesTheSetFromTheSession() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        var stream = store.sessions.observeSessions(from: Fixtures.monday, through: Fixtures.monday)
            .makeAsyncIterator()
        #expect(await stream.next()?.first?.items.first?.sets.map(\.id) == [set.id])
        try await store.sets.remove(setID: set.id)
        #expect(await stream.next()?.first?.items.first?.sets.isEmpty == true)
        try await store.sets.restore(setID: set.id)
        #expect(await stream.next()?.first?.items.first?.sets.map(\.id) == [set.id])
    }

    @Test func writesToARemovedSetThrowNotFound() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        try await store.sets.remove(setID: set.id)
        await #expect(throws: AppError(.notFound, detail: "workoutSet \(set.id)")) {
            try await store.sets.log(setID: set.id)
        }
    }
}
