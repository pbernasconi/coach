import Foundation
import GRDB
import LiftCore

/// Read queries behind `TemplateRepository`. Each returns live rows only.
enum TemplateQueries {
    static func templates(_ db: Database) throws -> [DayTemplate] {
        let templates =
            try TemplateRecord
            .filter(Column.deletedAt == nil)
            .order(Column.position, Column("name").collating(.nocase), Column.id)
            .fetchAll(db)
        return try attach(db, to: templates)
    }

    static func template(_ db: Database, id: UUID) throws -> DayTemplate? {
        let templates = try TemplateRecord.filter(key: id).filter(Column.deletedAt == nil).fetchAll(db)
        return try attach(db, to: templates).first
    }

    /// A live template, or `AppError(.notFound)`.
    static func liveTemplate(_ db: Database, id: UUID) throws -> TemplateRecord {
        guard let template = try TemplateRecord.fetchOne(db, key: id), template.deletedAt == nil else {
            throw AppError(.notFound, detail: "template \(id)")
        }
        return template
    }

    /// A template's live slots in order.
    static func liveSlots(_ db: Database, templateID: UUID) throws -> [TemplateExerciseRecord] {
        try TemplateExerciseRecord
            .filter(Column("templateID") == templateID)
            .filter(Column.deletedAt == nil)
            .order(Column.position, Column.id)
            .fetchAll(db)
    }

    /// Library rows by id, removed ones included (a template keeps showing what it plans).
    static func library(_ db: Database, ids: [UUID]) throws -> [UUID: Exercise] {
        guard !ids.isEmpty else { return [:] }
        let rows = try ExerciseRow.filter(Set(ids).contains(Column.id)).fetchAll(db)
        return Dictionary(rows.map { ($0.id, $0.exercise) }) { first, _ in first }
    }

    /// Loads the live slots of `templates` in one query; each slot shows its library exercise's current name.
    private static func attach(_ db: Database, to templates: [TemplateRecord]) throws -> [DayTemplate] {
        guard !templates.isEmpty else { return [] }
        let slots =
            try TemplateExerciseRecord
            .filter(templates.map(\.id).contains(Column("templateID")))
            .filter(Column.deletedAt == nil)
            .order(Column.position, Column.id)
            .fetchAll(db)
        let names = try library(db, ids: slots.map(\.slot.exerciseID)).mapValues(\.name)
        let slotsByTemplate = Dictionary(grouping: slots, by: \.templateID)
        return templates.map { template in
            DayTemplate(
                id: template.id,
                name: template.name,
                exercises: (slotsByTemplate[template.id] ?? []).map { record in
                    var slot = record.slot
                    slot.displayName = names[slot.exerciseID] ?? slot.displayName
                    return slot
                },
                position: template.position,
                createdAt: template.createdAt,
                updatedAt: template.updatedAt,
                deletedAt: template.deletedAt
            )
        }
    }
}
