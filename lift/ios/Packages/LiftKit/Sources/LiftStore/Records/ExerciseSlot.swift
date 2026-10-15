import Foundation
import LiftCore

/// What to stamp on a session exercise when it is added: a library exercise, or a free-text one.
public struct ExerciseSlot: Hashable, Sendable {
    public var exerciseID: UUID?
    public var displayName: String
    public var loadMode: LoadMode
    public var equipment: Equipment?
    public var restSeconds: Int?
    public var note: String?
    public var supersetGroup: Int?

    public init(
        exerciseID: UUID?,
        displayName: String,
        loadMode: LoadMode,
        equipment: Equipment?,
        restSeconds: Int? = nil,
        note: String? = nil,
        supersetGroup: Int? = nil
    ) {
        self.exerciseID = exerciseID
        self.displayName = displayName
        self.loadMode = loadMode
        self.equipment = equipment
        self.restSeconds = restSeconds
        self.note = note
        self.supersetGroup = supersetGroup
    }

    /// A slot for a library exercise, copying its name, load mode and equipment.
    public init(exercise: Exercise, restSeconds: Int? = nil) {
        self.init(
            exerciseID: exercise.id,
            displayName: exercise.name,
            loadMode: exercise.loadMode,
            equipment: exercise.equipment,
            restSeconds: restSeconds
        )
    }
}
