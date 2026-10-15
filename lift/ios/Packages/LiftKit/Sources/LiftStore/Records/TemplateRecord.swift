import Foundation
import GRDB
import LiftCore

/// One day template, as stored in the `template` table. Its slots live in `templateExercise`.
public struct TemplateRecord: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var position: Int
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(id: UUID, name: String, position: Int, createdAt: Date, updatedAt: Date, deletedAt: Date? = nil) {
        self.id = id
        self.name = name
        self.position = position
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

extension TemplateRecord: SyncedRecord {
    public static let databaseTableName = "template"
    static let entity = OutboxEntity.template

    public init(row: Row) throws {
        id = try row.required("id")
        name = try row.required("name")
        position = try row.required("position")
        createdAt = try row.required("createdAt")
        updatedAt = try row.required("updatedAt")
        deletedAt = try row.optional("deletedAt")
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["name"] = name
        container["position"] = position
        container["createdAt"] = createdAt
        container["updatedAt"] = updatedAt
        container["deletedAt"] = deletedAt
    }
}
