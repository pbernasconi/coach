import Foundation
import GRDB
import LiftCore
import LiftTesting
import Testing

@testable import LiftStore

/// v6 (DATA-5, TEST-5): `templateExercise.note`, and a planned session starting with the slot's note.
@Suite struct TemplateNoteMigrationTests {
    @Test func v6AddsANullableNoteAndKeepsV5Rows() throws {
        let queue = try DatabaseQueue()
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v5HealthWorkout)
        try queue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO template (id, name, position, createdAt, updatedAt)
                    VALUES (x'0123456789ABCDEF0123456789ABCDEF', 'T', 0, '2026-03-02 09:00:00.000', '2026-03-02 09:00:00.000')
                    """
            )
        }
        #expect(try queue.read { db in try db.columns(in: "templateExercise").map(\.name) }.contains("note") == false)
        try LiftMigrations.migrator.migrate(queue, upTo: LiftMigrations.v6TemplateNote)
        try queue.read { db in
            let column = try #require(try db.columns(in: "templateExercise").first { $0.name == "note" })
            #expect(column.type.uppercased() == "TEXT")
            #expect(column.isNotNull == false)
            #expect(try Row.fetchOne(db, sql: "SELECT name FROM template")?["name"] == "T")
        }
    }

    @Test func aSlotKeepsItsNoteAndAPlannedSessionStartsWithIt() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Test day")
        var slot = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        slot.note = "Made-up cue"
        #expect(try await store.templates.updateExercise(slot).note == "Made-up cue")
        let session = try await store.plans.createSession(from: template.id, on: Fixtures.monday, unit: .kg)
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        let detail = try #require(await stream.next() ?? nil)
        #expect(detail.items.first?.exercise.note == "Made-up cue")
        let entry = try #require(try await store.pendingOutbox().last { $0.entity == .templateExercise })
        #expect(entry.payload.contains("Made-up cue"))
    }
}
