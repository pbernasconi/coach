import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// Discard of a workout Start moved from a later day: `resetToPlanned` puts it back as planned on its day, in one
/// transaction with an outbox entry per changed row, and `undoReset` brings it back (TEST-5). Made-up values only (TEST-8).
@Suite struct SessionResetTests {
    private let later = Fixtures.monday.adding(days: 2)

    private func stored(_ store: TestStore, _ id: UUID) async throws -> SessionRecord? {
        try await store.database.writer.read { db in try SessionRecord.fetchOne(db, key: id) }
    }

    /// A squat session planned for `later`, moved to Monday and started, with one set logged and one planned.
    private func startedEarly(_ store: TestStore) async throws -> (SessionRecord, SetRecord, SetRecord) {
        let (session, slot) = try await store.sessionWithSquat()
        let first = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        let second = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        _ = try await store.sessions.reschedule(session.id, .move(to: later))
        _ = try await store.sessions.reschedule(session.id, .move(to: Fixtures.monday))
        _ = try await store.sessions.start(sessionID: session.id)
        _ = try await store.sets.saveValues(setID: first.id, reps: 6, weight: .kg(102.5))
        _ = try await store.sets.log(setID: first.id)
        try await store.drainOutbox()
        return (session, first, second)
    }

    @Test func resetPutsTheSessionBackAsPlannedOnItsDay() async throws {
        let store = try TestStore.make()
        let (session, first, second) = try await startedEarly(store)
        store.now.advance(seconds: 60)

        let reset = try await store.sessions.resetToPlanned(sessionID: session.id, on: later)

        let after = try #require(try await stored(store, session.id))
        #expect(after.deletedAt == nil)
        #expect(after.day == later)
        #expect(after.dayMovedAt == ManualNow.start.addingTimeInterval(60))
        #expect(after.startedAt == nil)
        let detail = try #require(
            try await store.database.writer.read { db in try SessionQueries.detail(db, id: session.id) }
        )
        let sets = detail.items.flatMap(\.sets)
        #expect(sets.map(\.status) == [.planned, .planned])
        #expect(sets[0].actualReps == nil && sets[0].actualWeight == nil && sets[0].completedAt == nil)
        #expect(sets[0].target == Fixtures.fiveAt100)
        #expect(reset.sets.map(\.id) == [first.id])  // the planned set is left alone
        #expect(sets[1] == second)
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity) == [.session, .set])
        #expect(entries.map(\.op) == [.update, .update])
    }

    @Test func undoResetBringsBackTheDayTheStartAndTheLoggedSet() async throws {
        let store = try TestStore.make()
        let (session, first, _) = try await startedEarly(store)
        let before = try #require(try await stored(store, session.id))
        let logged = try await store.database.writer.read { db in try SetRecord.fetchOne(db, key: first.id) }
        let reset = try await store.sessions.resetToPlanned(sessionID: session.id, on: later)
        try await store.drainOutbox()

        try await store.sessions.undoReset(reset)

        let after = try #require(try await stored(store, session.id))
        #expect(after.day == Fixtures.monday)
        #expect(after.startedAt == before.startedAt)
        let set = try await store.database.writer.read { db in try SetRecord.fetchOne(db, key: first.id) }
        #expect(set?.status == .done)
        #expect(set?.actualReps == 6)
        #expect(set?.actualWeight == logged?.actualWeight)
        #expect(set?.completedAt == logged?.completedAt)
        #expect(try await store.pendingOutbox().map(\.entity) == [.session, .set])
    }
}
