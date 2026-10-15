import Foundation
import GRDB
import LiftCore

/// The `exercise` table row. Wraps the LiftCore `Exercise` so the GRDB conformance stays in Store.
struct ExerciseRow: Hashable, Sendable {
    var exercise: Exercise
}

extension ExerciseRow: SyncedRecord {
    static let databaseTableName = "exercise"
    static let entity = OutboxEntity.exercise

    var id: UUID { exercise.id }

    var updatedAt: Date {
        get { exercise.updatedAt }
        set { exercise.updatedAt = newValue }
    }

    var deletedAt: Date? {
        get { exercise.deletedAt }
        set { exercise.deletedAt = newValue }
    }

    init(row: Row) throws {
        let url: String? = try row.optional("videoURL")
        let id: UUID = try row.required("id")
        // A seed row always links to its entry, even from a pulled payload written before v3 added the column.
        let catalogID: String? = try row.optional("catalogID") ?? CatalogSeedLinks.catalogID(forSeedExerciseID: id)
        exercise = Exercise(
            id: id,
            name: try row.required("name"),
            aliases: try row.jsonArray("aliases"),
            equipment: try row.raw("equipment"),
            loadMode: try row.loadMode(),
            primary: try row.jsonArray("primaryMuscles"),
            secondary: try row.jsonArray("secondaryMuscles"),
            videoURL: url.flatMap(URL.init(string:)),
            catalogID: catalogID,
            isArchived: try row.required("isArchived"),
            createdAt: try row.required("createdAt"),
            updatedAt: try row.required("updatedAt"),
            deletedAt: try row.optional("deletedAt")
        )
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = exercise.id
        container["name"] = exercise.name
        try container.setJSONArray(exercise.aliases, forKey: "aliases")
        container["equipment"] = exercise.equipment.rawValue
        container.setLoadMode(exercise.loadMode)
        try container.setJSONArray(exercise.primary, forKey: "primaryMuscles")
        try container.setJSONArray(exercise.secondary, forKey: "secondaryMuscles")
        container["videoURL"] = exercise.videoURL?.absoluteString
        container["catalogID"] = exercise.catalogID
        container["isArchived"] = exercise.isArchived
        container["createdAt"] = exercise.createdAt
        container["updatedAt"] = exercise.updatedAt
        container["deletedAt"] = exercise.deletedAt
    }
}
