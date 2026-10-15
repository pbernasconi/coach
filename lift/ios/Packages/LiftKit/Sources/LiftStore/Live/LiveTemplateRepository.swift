import Foundation
import GRDB
import LiftCore

/// GRDB-backed `TemplateRepository`.
public struct LiveTemplateRepository: TemplateRepository {
    private let store: StoreWriter

    public init(database: LiftDatabase, now: @escaping @Sendable () -> Date, makeID: @escaping @Sendable () -> UUID) {
        store = StoreWriter(writer: database.writer, now: now, makeID: makeID)
    }

    public func observeTemplates() -> AsyncStream<[DayTemplate]> {
        ObservedStream.make(in: store.writer) { db in try TemplateQueries.templates(db) }
    }

    public func observeTemplate(id: UUID) -> AsyncStream<DayTemplate?> {
        ObservedStream.make(in: store.writer) { db in try TemplateQueries.template(db, id: id) }
    }

    public func createTemplate(name: String) async throws -> DayTemplate {
        let store = store
        return try await store.transaction { db, stamp in
            let record = try Self.newTemplate(name: name, store: store, stamp: stamp, db)
            return try TemplateQueries.template(db, id: record.id) ?? Self.empty(record)
        }
    }

    public func renameTemplate(id: UUID, to name: String) async throws {
        let name = try Self.validName(name)
        _ = try await store.change(TemplateRecord.self, id: id) { template, _ in template.name = name }
    }

    public func removeTemplate(id: UUID) async throws {
        try await store.softDelete(TemplateRecord.self, id: id)
    }

    public func restoreTemplate(id: UUID) async throws {
        try await store.restore(TemplateRecord.self, id: id)
    }

    public func addExercise(_ exercise: Exercise, to templateID: UUID) async throws -> TemplateExercise {
        let store = store
        return try await store.transaction { db, stamp in
            _ = try TemplateQueries.liveTemplate(db, id: templateID)
            let builder = SessionBuilder(store: store, db: db, stamp: stamp, gym: .standard)  // history only
            let last = try builder.history(of: exercise.id).last
            let slot = SlotPlanner.slot(id: store.makeID(), exercise: exercise, last: last)
            let record = TemplateExerciseRecord(
                templateID: templateID,
                position: try Self.nextSlotPosition(templateID, db),
                slot: slot,
                createdAt: stamp,
                updatedAt: stamp
            )
            try store.insertRow(record, at: stamp, db)
            return slot
        }
    }

    public func updateExercise(_ slot: TemplateExercise) async throws -> TemplateExercise {
        guard slot.sets >= 1, slot.repRange.lowerBound >= 1, (slot.restSeconds ?? 0) >= 0 else {
            throw AppError(.invalidInput, detail: "template slot")
        }
        return try await store.change(TemplateExerciseRecord.self, id: slot.id) { record, _ in
            var edited = slot
            edited.exerciseID = record.slot.exerciseID
            edited.displayName = record.slot.displayName
            record.slot = edited
        }
        .after.slot
    }

    public func removeExercise(id: UUID) async throws {
        try await store.softDelete(TemplateExerciseRecord.self, id: id)
    }

    public func restoreExercise(id: UUID) async throws {
        try await store.restore(TemplateExerciseRecord.self, id: id)
    }

    public func reorderExercises(in templateID: UUID, ids: [UUID]) async throws {
        let store = store
        try await store.transaction { db, stamp in
            _ = try TemplateQueries.liveTemplate(db, id: templateID)
            let slots = try TemplateQueries.liveSlots(db, templateID: templateID)
            try Reordering.apply(slots, ids: ids, store: store, stamp: stamp, db)
        }
    }

    public func saveAsTemplate(sessionID: UUID, name: String) async throws -> DayTemplate {
        let store = store
        return try await store.transaction { db, stamp in
            guard let detail = try SessionQueries.detail(db, id: sessionID) else {
                throw AppError(.notFound, detail: "session \(sessionID)")
            }
            let template = try Self.newTemplate(name: name, store: store, stamp: stamp, db)
            for (position, slot) in SessionSlots.slots(of: detail, makeID: store.makeID).enumerated() {
                let record = TemplateExerciseRecord(
                    templateID: template.id,
                    position: position,
                    slot: slot,
                    createdAt: stamp,
                    updatedAt: stamp
                )
                try store.insertRow(record, at: stamp, db)
            }
            var session = detail.session
            session.templateID = template.id
            try store.updateRow(session, at: stamp, db)
            return try TemplateQueries.template(db, id: template.id) ?? Self.empty(template)
        }
    }

    // MARK: - Helpers

    private static func newTemplate(name: String, store: StoreWriter, stamp: Date, _ db: Database) throws
        -> TemplateRecord
    {
        let next = try Int.fetchOne(db, sql: "SELECT COALESCE(MAX(position), -1) + 1 FROM template") ?? 0
        let record = TemplateRecord(
            id: store.makeID(),
            name: try validName(name),
            position: next,
            createdAt: stamp,
            updatedAt: stamp
        )
        try store.insertRow(record, at: stamp, db)
        return record
    }

    private static func nextSlotPosition(_ templateID: UUID, _ db: Database) throws -> Int {
        try SessionQueries.nextPosition(
            db,
            table: TemplateExerciseRecord.databaseTableName,
            parentColumn: "templateID",
            parentID: templateID
        )
    }

    /// A trimmed, non-empty name.
    private static func validName(_ name: String) throws -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw AppError(.invalidInput, detail: "template name") }
        return trimmed
    }

    private static func empty(_ record: TemplateRecord) -> DayTemplate {
        DayTemplate(
            id: record.id,
            name: record.name,
            exercises: [],
            position: record.position,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        )
    }
}
