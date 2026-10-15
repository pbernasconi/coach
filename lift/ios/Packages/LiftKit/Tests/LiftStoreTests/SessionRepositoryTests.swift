import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct SessionRepositoryTests {
    private let week = (first: Fixtures.monday, last: Fixtures.monday.adding(days: 6))

    @Test func createSessionWritesExactlyOneOutboxEntry() async throws {
        let store = try TestStore.make()
        let session = try await store.sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: .kg,
            templateID: nil
        )
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity) == [.session])
        #expect(entries.map(\.rowID) == [session.id])
        #expect(entries.first?.payload.contains("\"day\":\"2026-03-02\"") == true)
    }

    @Test func observeSessionsEmitsOnEveryChangeInRange() async throws {
        let store = try TestStore.make()
        var stream = store.sessions.observeSessions(from: week.first, through: week.last).makeAsyncIterator()
        #expect(await stream.next() == [])
        let session = try await store.sessions.createSession(on: week.last, title: "Upper A", unit: .kg, templateID: nil)
        #expect(await stream.next()?.map(\.session) == [session])
        _ = try await store.sessions.addExercise(ExerciseSlot(exercise: Fixtures.squat), to: session.id)
        #expect(await stream.next()?.first?.items.map(\.exercise.displayName) == ["Back squat"])
    }

    @Test func observeSessionsLeavesOutOtherDaysAndOrdersByDay() async throws {
        let store = try TestStore.make()
        let late = try await store.sessions.createSession(on: week.last, title: "B", unit: .kg, templateID: nil)
        let early = try await store.sessions.createSession(on: week.first, title: "A", unit: .kg, templateID: nil)
        _ = try await store.sessions.createSession(on: week.last.adding(days: 1), title: "C", unit: .kg, templateID: nil)
        var stream = store.sessions.observeSessions(from: week.first, through: week.last).makeAsyncIterator()
        #expect(await stream.next()?.map(\.id) == [early.id, late.id])
    }

    @Test func addExerciseStampsLoadModeAndEquipmentInOrder() async throws {
        let store = try TestStore.make()
        let (session, squat) = try await store.sessionWithSquat()
        let bench = try await store.sessions.addExercise(ExerciseSlot(exercise: Fixtures.dumbbellBench), to: session.id)
        #expect(squat.position == 0)
        #expect(bench.position == 1)
        #expect(bench.loadMode == .perHand)
        #expect(bench.equipment == .dumbbell)
        #expect(bench.exerciseID == Fixtures.dumbbellBench.id)
        #expect(try await store.pendingOutbox().map(\.entity) == [.sessionExercise])
    }

    @Test func addExerciseToARemovedSessionThrowsAndWritesNothing() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.reschedule(session.id, .remove)
        try await store.drainOutbox()
        await #expect(throws: AppError(.notFound, detail: "session \(session.id)")) {
            try await store.sessions.addExercise(ExerciseSlot(exercise: Fixtures.squat), to: session.id)
        }
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func removeExerciseHidesItAndItsSets() async throws {
        let store = try TestStore.make()
        let (session, squat) = try await store.sessionWithSquat()
        _ = try await store.sets.addSet(to: squat.id, kind: .working, target: Fixtures.fiveAt100)
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        #expect(await stream.next()??.items.first?.sets.count == 1)
        try await store.sessions.removeExercise(id: squat.id)
        #expect(await stream.next()??.items.isEmpty == true)
    }

    @Test func domainViewCarriesSetsAndStamps() async throws {
        let store = try TestStore.make()
        let set = try await store.plannedSet()
        let logged = try await store.sets.log(setID: set.id)
        var stream = store.sessions.observeSessions(from: week.first, through: week.last).makeAsyncIterator()
        let session = await stream.next()?.first?.domain
        #expect(session?.unitsAtLog == .kg)
        #expect(session?.exercises.first?.loadMode == .total)
        #expect(session?.allSets == [logged.loggedSet])
        #expect(session?.isCompleted == true)
    }
}
