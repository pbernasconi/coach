import Foundation
import GRDB
import LiftCore

/// One exercise slot of a template, as stored in the `templateExercise` table.
struct TemplateExerciseRecord: Hashable, Sendable, Identifiable {
    var templateID: UUID
    var position: Int
    var slot: TemplateExercise
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?

    var id: UUID { slot.id }
}

extension TemplateExerciseRecord: SyncedRecord {
    static let databaseTableName = "templateExercise"
    static let entity = OutboxEntity.templateExercise

    init(row: Row) throws {
        templateID = try row.required("templateID")
        position = try row.required("position")
        let repMin: Int = try row.required("repMin")
        let repMax: Int = try row.required("repMax")
        let setCount: Int = try row.required("setCount")
        guard repMin >= 1, repMax >= repMin, setCount >= 1 else {
            throw AppError(.decoding, detail: "templateExercise")
        }
        slot = TemplateExercise(
            id: try row.required("id"),
            exerciseID: try row.required("exerciseID"),
            displayName: try row.required("displayName"),
            sets: setCount,
            repRange: repMin...repMax,
            weight: try row.weight("weightValue", unitColumn: "weightUnit"),
            restSeconds: try row.optional("restSeconds"),
            kind: try row.raw("kind"),
            note: try row.optional("note")
        )
        createdAt = try row.required("createdAt")
        updatedAt = try row.required("updatedAt")
        deletedAt = try row.optional("deletedAt")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = slot.id
        container["templateID"] = templateID
        container["position"] = position
        container["exerciseID"] = slot.exerciseID
        container["displayName"] = slot.displayName
        container["setCount"] = slot.sets
        container["repMin"] = slot.repRange.lowerBound
        container["repMax"] = slot.repRange.upperBound
        container["weightValue"] = slot.weight?.value
        container["weightUnit"] = slot.weight?.unit.rawValue
        container["restSeconds"] = slot.restSeconds
        container["kind"] = slot.kind.rawValue
        container["note"] = slot.note
        container["createdAt"] = createdAt
        container["updatedAt"] = updatedAt
        container["deletedAt"] = deletedAt
    }
}
