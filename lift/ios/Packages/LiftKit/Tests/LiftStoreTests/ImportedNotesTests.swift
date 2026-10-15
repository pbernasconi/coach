import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// The writes an import uses to keep what a note says: session and warm-up notes, next-time weights, set notes, and
/// sets stamped with the workout's time rather than the import's. Made-up values only (TEST-8).
@Suite struct ImportedNotesTests {
    private static let noon = ManualNow.start.addingTimeInterval(-3 * 86_400)

    @Test func anImportedSessionIsOneInsertWithItsNotes() async throws {
        let store = try TestStore.make()
        let imported = Session(
            id: UUID(),
            date: Fixtures.monday,
            title: "Push",
            warmUpNote: "5 min rower",
            note: "Next time: start earlier",
            unitsAtLog: .kg,
            createdAt: .distantPast,
            updatedAt: .distantPast
        )
        let session = try await store.sessions.createImportedSession(imported)
        #expect(session.day == Fixtures.monday)
        #expect(session.title == "Push")
        #expect(session.unitsAtLog == .kg)
        #expect(session.createdAt == ManualNow.start)
        let outbox = try await store.pendingOutbox()
        #expect(outbox.map(\.op) == [.insert])
        #expect(outbox.map(\.rowID) == [session.id])
        let detail = try #require(await first(store.sessions.observeSession(id: session.id)))
        #expect(detail.domain.note == "Next time: start earlier")
        #expect(detail.domain.warmUpNote == "5 min rower")
    }

    @Test func aSlotKeepsItsNextTimeWeight() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        var slot = ExerciseSlot(exercise: Fixtures.dumbbellBench)
        slot.nextTimeHint = .kg(22)
        slot.note = "next time 22kg"
        let added = try await store.sessions.addExercise(slot, to: session.id)
        let detail = try #require(await first(store.sessions.observeSession(id: session.id)))
        let stored = try #require(detail.items.first { $0.id == added.id })
        #expect(stored.exercise.nextTimeHint == .kg(22))
        #expect(detail.domain.exercises.last?.nextTimeHint == .kg(22))
        #expect(stored.exercise.note == "next time 22kg")
    }

    @Test func aDoneImportedSetIsOneInsertStampedWithTheWorkoutTime() async throws {
        let store = try TestStore.make()
        let (_, slot) = try await store.sessionWithSquat()
        let imported = LoggedSet(
            id: UUID(),
            target: Fixtures.fiveAt100,
            actual: SetActual(reps: 4, weight: .kg(97.5)),
            note: "paused"
        )
        let set = try await store.sets.addImported(imported, to: slot.id, completedAt: Self.noon)
        #expect(set.status == .done)
        #expect(set.actualReps == 4)
        #expect(set.actualWeight == .kg(97.5))
        #expect(set.note == "paused")
        #expect(set.completedAt == Self.noon)
        #expect(set.createdAt == ManualNow.start)
        #expect(set.loggedSet.actual?.completedAt == Self.noon)
        let outbox = try await store.pendingOutbox()
        #expect(outbox.map(\.op) == [.insert])
        #expect(outbox.first?.payload.contains("\"note\":\"paused\"") == true)
    }

    @Test func aDoneImportedSetWithoutValuesTakesItsTarget() async throws {
        let store = try TestStore.make()
        let (_, slot) = try await store.sessionWithSquat()
        let imported = LoggedSet(id: UUID(), target: Fixtures.fiveAt100, actual: SetActual())
        let set = try await store.sets.addImported(imported, to: slot.id, completedAt: Self.noon)
        #expect(set.actualReps == 5)
        #expect(set.actualWeight == .kg(100))
    }

    @Test func aSkippedImportedSetIsSkippedAtTheWorkoutTime() async throws {
        let store = try TestStore.make()
        let (_, slot) = try await store.sessionWithSquat()
        let imported = LoggedSet(id: UUID(), target: Fixtures.fiveAt100, note: "didn't do it", isSkipped: true)
        let set = try await store.sets.addImported(imported, to: slot.id, completedAt: Self.noon)
        #expect(set.status == .skipped)
        #expect(set.actualReps == nil)
        #expect(set.completedAt == Self.noon)
        #expect(set.note == "didn't do it")
    }

    @Test func aPlannedImportedSetHasNoCompletedAt() async throws {
        let store = try TestStore.make()
        let (_, slot) = try await store.sessionWithSquat(unit: .lb)
        let imported = LoggedSet(id: UUID(), target: Fixtures.fiveAt100)
        let set = try await store.sets.addImported(imported, to: slot.id, completedAt: Self.noon)
        #expect(set.status == .planned)
        #expect(set.completedAt == nil)
        #expect(set.target.weight == Weight.kg(100).converted(to: .lb))
    }

    private func first<Value: Sendable>(_ stream: AsyncStream<Value?>) async -> Value? {
        for await value in stream { return value }
        return nil
    }
}
