import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct ExerciseHistoryTests {
    /// A session on `day` holding `exercise` with one set per status in `statuses`. Returns the session and its sets.
    private func session(
        _ store: TestStore,
        on day: LocalDay,
        exercise: Exercise = Fixtures.squat,
        statuses: [SetStatus]
    ) async throws -> (SessionRecord, [SetRecord]) {
        let session = try await store.sessions.createSession(on: day, title: "Lower", unit: .kg, templateID: nil)
        let slot = try await store.sessions.addExercise(ExerciseSlot(exercise: exercise), to: session.id)
        var sets: [SetRecord] = []
        for status in statuses {
            let set = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
            switch status {
            case .done: sets.append(try await store.sets.log(setID: set.id))
            case .skipped: sets.append(try await store.sets.skip(setID: set.id))
            case .planned: sets.append(set)
            }
        }
        return (session, sets)
    }

    @Test func historyListsLoggedSessionsNewestFirstWithOnlyLoggedSets() async throws {
        let store = try TestStore.make()
        let (older, olderSets) = try await session(store, on: Fixtures.monday, statuses: [.done, .skipped])
        let (newer, newerSets) = try await session(
            store,
            on: Fixtures.monday.adding(days: 3),
            statuses: [.done, .done]
        )
        _ = try await session(store, on: Fixtures.monday.adding(days: 5), statuses: [.planned, .skipped])
        _ = try await session(
            store,
            on: Fixtures.monday.adding(days: 6),
            exercise: Fixtures.dumbbellBench,
            statuses: [.done]
        )

        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 5).makeAsyncIterator()
        let entries = try #require(await stream.next())

        #expect(entries.map(\.id) == [newer.id, older.id])
        #expect(entries.map { $0.sets.map(\.id) } == [newerSets.map(\.id), [olderSets[0].id]])
        #expect(entries.first?.loadMode == .total)
    }

    @Test func historyCarriesTheExerciseNoteOfEachSession() async throws {
        let store = try TestStore.make()
        let (older, olderSets) = try await session(store, on: Fixtures.monday, statuses: [.done])
        let (newer, _) = try await session(store, on: Fixtures.monday.adding(days: 3), statuses: [.done])
        _ = try await store.sessions.saveExerciseNote(id: olderSets[0].sessionExerciseID, note: "  Felt heavy  ")

        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 5).makeAsyncIterator()
        let entries = try #require(await stream.next())

        #expect(entries.map(\.id) == [newer.id, older.id])
        #expect(entries.map(\.note) == [nil, "Felt heavy"])
    }

    @Test func historyKeepsOnlyTheLatestSessionsUpToTheLimit() async throws {
        let store = try TestStore.make()
        var ids: [UUID] = []
        for offset in 0..<4 {
            ids.append(try await session(store, on: Fixtures.monday.adding(days: offset), statuses: [.done]).0.id)
        }

        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 2).makeAsyncIterator()

        #expect(await stream.next()?.map(\.id) == [ids[3], ids[2]])
        var none = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 0).makeAsyncIterator()
        #expect(await none.next() == [])
    }

    @Test func historyLeavesOutRemovedSessionsAndSets() async throws {
        let store = try TestStore.make()
        let (removed, _) = try await session(store, on: Fixtures.monday, statuses: [.done])
        let (kept, keptSets) = try await session(store, on: Fixtures.monday.adding(days: 1), statuses: [.done, .done])
        _ = try await store.sessions.reschedule(removed.id, .remove)
        try await store.sets.remove(setID: keptSets[1].id)

        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 5).makeAsyncIterator()
        let entries = try #require(await stream.next())

        #expect(entries.map(\.id) == [kept.id])
        #expect(entries.first?.sets.map(\.id) == [keptSets[0].id])
    }

    @Test func historyUpdatesWhenASetIsLogged() async throws {
        let store = try TestStore.make()
        let (session, sets) = try await session(store, on: Fixtures.monday, statuses: [.planned])
        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 5).makeAsyncIterator()
        #expect(await stream.next() == [])

        _ = try await store.sets.log(setID: sets[0].id)

        #expect(await stream.next()?.map(\.id) == [session.id])
    }
}
