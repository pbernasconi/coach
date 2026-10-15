import Foundation
import GRDB
import LiftCore

/// One exercise inside a session, as stored in the `sessionExercise` table. Load mode and equipment are
/// stamped when the exercise is added (DATA-6), so a later library edit cannot reinterpret history.
public struct SessionExerciseRecord: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var sessionID: UUID
    public var exerciseID: UUID?
    public var position: Int
    public var displayName: String
    public var loadMode: LoadMode
    public var equipment: Equipment?
    public var restSeconds: Int?
    public var note: String?
    public var supersetGroup: Int?
    public var nextTimeHint: Weight?
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(
        id: UUID,
        sessionID: UUID,
        slot: ExerciseSlot,
        position: Int,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil
    ) {
        self.id = id
        self.sessionID = sessionID
        self.exerciseID = slot.exerciseID
        self.position = position
        self.displayName = slot.displayName
        self.loadMode = slot.loadMode
        self.equipment = slot.equipment
        self.restSeconds = slot.restSeconds
        self.note = slot.note
        self.supersetGroup = slot.supersetGroup
        self.nextTimeHint = nil
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

extension SessionExerciseRecord: SyncedRecord {
    public static let databaseTableName = "sessionExercise"
    static let entity = OutboxEntity.sessionExercise

    public init(row: Row) throws {
        id = try row.required("id")
        sessionID = try row.required("sessionID")
        exerciseID = try row.optional("exerciseID")
        position = try row.required("position")
        displayName = try row.required("displayName")
        loadMode = try row.loadMode()
        equipment = try row.optionalRaw("equipment")
        restSeconds = try row.optional("restSeconds")
        note = try row.optional("note")
        supersetGroup = try row.optional("supersetGroup")
        nextTimeHint = try row.weight("nextTimeHintValue", unitColumn: "nextTimeHintUnit")
        createdAt = try row.required("createdAt")
        updatedAt = try row.required("updatedAt")
        deletedAt = try row.optional("deletedAt")
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["sessionID"] = sessionID
        container["exerciseID"] = exerciseID
        container["position"] = position
        container["displayName"] = displayName
        container.setLoadMode(loadMode)
        container["equipment"] = equipment?.rawValue
        container["restSeconds"] = restSeconds
        container["note"] = note
        container["supersetGroup"] = supersetGroup
        container["nextTimeHintValue"] = nextTimeHint?.value
        container["nextTimeHintUnit"] = nextTimeHint?.unit.rawValue
        container["createdAt"] = createdAt
        container["updatedAt"] = updatedAt
        container["deletedAt"] = deletedAt
    }
}
