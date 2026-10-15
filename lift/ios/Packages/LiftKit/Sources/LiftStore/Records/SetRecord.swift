import Foundation
import GRDB
import LiftCore

/// One set, as stored in the `workoutSet` table. It keeps target and actual side by side (DATA-7) and is
/// stamped with its unit and load mode (DATA-6). Weights are always held in `unit`.
///
/// `actualReps`/`actualWeight` hold the values the user saved, whether or not the set is logged yet;
/// `status` alone says whether it was logged.
public struct SetRecord: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var sessionExerciseID: UUID
    public var position: Int
    public var kind: SetKind
    public var target: SetTarget
    public var actualReps: Int?
    public var actualWeight: Weight?
    public var unit: WeightUnit
    public var loadMode: LoadMode
    public var status: SetStatus
    public var completedAt: Date?
    public var note: String?
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    /// A planned set with no actual values yet. Weights are converted into `unit`.
    public init(
        id: UUID,
        sessionExerciseID: UUID,
        position: Int,
        kind: SetKind,
        target: SetTarget,
        unit: WeightUnit,
        loadMode: LoadMode,
        createdAt: Date
    ) {
        self.id = id
        self.sessionExerciseID = sessionExerciseID
        self.position = position
        self.kind = kind
        var target = target
        target.weight = target.weight?.converted(to: unit)
        self.target = target
        self.actualReps = nil
        self.actualWeight = nil
        self.unit = unit
        self.loadMode = loadMode
        self.status = .planned
        self.completedAt = nil
        self.note = nil
        self.createdAt = createdAt
        self.updatedAt = createdAt
        self.deletedAt = nil
    }

    /// Takes an imported set's note, values and status. A done set without values gets its target's, as `log` does;
    /// a skipped set keeps any values it has.
    mutating func apply(imported set: LoggedSet, completedAt: Date?) {
        note = set.note
        actualReps = set.actual?.reps
        actualWeight = set.actual?.weight?.converted(to: unit)
        if set.isSkipped {
            status = .skipped
        } else if set.actual != nil {
            status = .done
            actualReps = actualReps ?? target.reps ?? target.repRange?.lowerBound
            actualWeight = actualWeight ?? target.weight
        }
        self.completedAt = status == .planned ? nil : completedAt
    }

    /// The domain view. A planned set has no actual, even when values were saved on it.
    public var loggedSet: LoggedSet {
        LoggedSet(
            id: id,
            kind: kind,
            target: target,
            actual: status == .planned
                ? nil : SetActual(reps: actualReps, weight: actualWeight, completedAt: completedAt),
            note: note,
            isSkipped: status == .skipped
        )
    }
}

extension SetRecord: SyncedRecord {
    public static let databaseTableName = "workoutSet"
    static let entity = OutboxEntity.set

    public init(row: Row) throws {
        id = try row.required("id")
        sessionExerciseID = try row.required("sessionExerciseID")
        position = try row.required("position")
        kind = try row.raw("kind")
        unit = try row.raw("unit")
        let repMin: Int? = try row.optional("targetRepMin")
        let repMax: Int? = try row.optional("targetRepMax")
        let targetWeight: Double? = try row.optional("targetWeight")
        target = SetTarget(
            reps: try row.optional("targetReps"),
            repRange: SetRecord.range(repMin, repMax),
            weight: targetWeight.map { [unit] in Weight($0, unit) }
        )
        actualReps = try row.optional("actualReps")
        let actualValue: Double? = try row.optional("actualWeight")
        actualWeight = actualValue.map { [unit] in Weight($0, unit) }
        loadMode = try row.loadMode()
        status = try row.raw("status")
        completedAt = try row.optional("completedAt")
        note = try row.optional("note")
        createdAt = try row.required("createdAt")
        updatedAt = try row.required("updatedAt")
        deletedAt = try row.optional("deletedAt")
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["sessionExerciseID"] = sessionExerciseID
        container["position"] = position
        container["kind"] = kind.rawValue
        container["targetReps"] = target.reps
        container["targetRepMin"] = target.repRange?.lowerBound
        container["targetRepMax"] = target.repRange?.upperBound
        container["targetWeight"] = target.weight?.converted(to: unit).value
        container["actualReps"] = actualReps
        container["actualWeight"] = actualWeight?.converted(to: unit).value
        container["unit"] = unit.rawValue
        container.setLoadMode(loadMode)
        container["status"] = status.rawValue
        container["completedAt"] = completedAt
        container["note"] = note
        container["createdAt"] = createdAt
        container["updatedAt"] = updatedAt
        container["deletedAt"] = deletedAt
    }

    private static func range(_ lower: Int?, _ upper: Int?) -> ClosedRange<Int>? {
        guard let lower, let upper, lower <= upper else { return nil }
        return lower...upper
    }
}
