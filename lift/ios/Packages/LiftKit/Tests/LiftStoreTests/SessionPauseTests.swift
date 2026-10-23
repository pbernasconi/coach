import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// v9 (DATA-5, TEST-5): Pause. A pause stamps `pausedAt`, a resume adds its whole seconds to `pausedSeconds`, Finish
/// ends a running pause, and changes that do not apply write nothing. Also the start moved and the rename. Made-up
/// values only (TEST-8).
@Suite struct SessionPauseTests {
    private func stored(_ store: TestStore, _ id: UUID) async throws -> SessionRecord? {
        try await store.database.writer.read { db in try SessionRecord.fetchOne(db, key: id) }
    }

    private func started(_ store: TestStore) async throws -> SessionRecord {
        let (session, _) = try await store.sessionWithSquat()
        _ = try await store.sessions.start(sessionID: session.id)
        try await store.drainOutbox()
        return session
    }

    @Test func v9AddsThePauseColumnsAndKeepsV8Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v8SessionDayMovedAt)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO session (id, day, title, unitsAtLog, createdAt, updatedAt)
                    VALUES (x'0123456789ABCDEF0123456789ABCDEF', '2026-03-02', 'Test', 'kg', '2026-03-02 09:00:00.000',
                            '2026-03-02 09:00:00.000')
                    """
            )
        }
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v9SessionPause)
        try queue.read { db in
            let columns = try db.columns(in: "session")
            let pausedAt = try #require(columns.first { $0.name == "pausedAt" })
            #expect(pausedAt.isNotNull == false)
            let seconds = try #require(columns.first { $0.name == "pausedSeconds" })
            #expect(seconds.isNotNull)
            let record = try SessionRecord(row: try #require(try Row.fetchOne(db, sql: "SELECT * FROM session")))
            #expect(record.pausedAt == nil)
            #expect(record.pausedSeconds == 0)
        }
    }

    @Test func pauseThenResumeAddsTheWholeSecondsWithOneOutboxEntryEach() async throws {
        let store = try TestStore.make()
        let session = try await started(store)

        store.now.advance(seconds: 60)
        let paused = try await store.sessions.changeTime(sessionID: session.id, .pause)
        #expect(paused.pausedAt == ManualNow.start.addingTimeInterval(60))
        #expect(try await store.pendingOutbox().count == 1)

        store.now.advance(seconds: 190.7)
        let resumed = try await store.sessions.changeTime(sessionID: session.id, .resume)
        #expect(resumed.pausedAt == nil)
        #expect(resumed.pausedSeconds == 190)
        #expect(try await store.pendingOutbox().count == 2)

        store.now.advance(seconds: 30)
        _ = try await store.sessions.changeTime(sessionID: session.id, .pause)
        store.now.advance(seconds: 10)
        let again = try await store.sessions.changeTime(sessionID: session.id, .resume)
        #expect(again.pausedSeconds == 200)
    }

    @Test func changesThatDoNotApplyWriteNothing() async throws {
        let store = try TestStore.make()
        let (fresh, _) = try await store.sessionWithSquat()
        try await store.drainOutbox()
        #expect(try await store.sessions.changeTime(sessionID: fresh.id, .pause).pausedAt == nil)  // never started
        #expect(try await store.sessions.changeTime(sessionID: fresh.id, .resume).pausedAt == nil)  // not paused
        #expect(try await store.pendingOutbox().isEmpty)

        let session = try await started(store)
        _ = try await store.sessions.changeTime(sessionID: session.id, .pause)
        store.now.advance(seconds: 5)
        let twice = try await store.sessions.changeTime(sessionID: session.id, .pause)
        #expect(twice.pausedAt == ManualNow.start)
        #expect(try await store.pendingOutbox().count == 1)
    }

    @Test func finishingAPausedWorkoutLeavesThePauseOut() async throws {
        let store = try TestStore.make()
        let session = try await started(store)
        store.now.advance(seconds: 600)
        _ = try await store.sessions.changeTime(sessionID: session.id, .pause)
        store.now.advance(seconds: 120)
        let finished = try await store.sessions.finish(sessionID: session.id)
        #expect(finished.pausedAt == nil)
        #expect(finished.pausedSeconds == 120)
        #expect(try await store.sessions.changeTime(sessionID: session.id, .pause).pausedAt == nil)
    }

    @Test func theStartMovesButNeverPastTheFinishOrNow() async throws {
        let store = try TestStore.make()
        let session = try await started(store)
        let earlier = ManualNow.start.addingTimeInterval(-900)
        #expect(try await store.sessions.changeTime(sessionID: session.id, .start(at: earlier)).startedAt == earlier)
        let later = ManualNow.start.addingTimeInterval(3600)
        #expect(try await store.sessions.changeTime(sessionID: session.id, .start(at: later)).startedAt == ManualNow.start)
    }

    @Test func renameTrimsAndKeepsTheTitleWhenEmpty() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        try await store.drainOutbox()
        #expect(try await store.sessions.rename(sessionID: session.id, title: "  Legs  ").title == "Legs")
        #expect(try await store.sessions.rename(sessionID: session.id, title: "   ").title == "Legs")
        #expect(try await stored(store, session.id)?.title == "Legs")
        #expect(try await store.pendingOutbox().count == 1)
    }

    @Test func theSummaryLengthLeavesThePauseOut() {
        let start = ManualNow.start
        let session = Session(
            id: IDSequence.id(1, prefix: 0x5A),
            date: Fixtures.monday,
            title: "Lower A",
            startedAt: start,
            finishedAt: start.addingTimeInterval(3000),
            unitsAtLog: .kg,
            createdAt: start,
            updatedAt: start,
            pausedSeconds: 600
        )
        #expect(WorkoutSummarizer.summarize(session, earlier: [:], unit: .kg).duration == 2400)
    }
}
