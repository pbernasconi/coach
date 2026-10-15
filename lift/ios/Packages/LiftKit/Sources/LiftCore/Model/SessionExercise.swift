import Foundation

/// One exercise as performed in a session. `displayName` is always kept, even when matched to the library.
public struct SessionExercise: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var exerciseID: UUID?
    public var displayName: String
    /// Stamped when logged (DATA-6) so a later library edit cannot reinterpret history.
    public var loadMode: LoadMode
    /// Stamped when known, so unmatched exercises still get a sensible increment.
    public var equipment: Equipment?
    public var sets: [LoggedSet]
    public var restSeconds: Int?
    public var note: String?
    public var supersetGroup: Int?
    /// A weight the user wrote for next time ("next time bump to 190lb").
    public var nextTimeHint: Weight?

    public init(
        id: UUID,
        exerciseID: UUID? = nil,
        displayName: String,
        loadMode: LoadMode,
        equipment: Equipment? = nil,
        sets: [LoggedSet] = [],
        restSeconds: Int? = nil,
        note: String? = nil,
        supersetGroup: Int? = nil,
        nextTimeHint: Weight? = nil
    ) {
        self.id = id
        self.exerciseID = exerciseID
        self.displayName = displayName
        self.loadMode = loadMode
        self.equipment = equipment
        self.sets = sets
        self.restSeconds = restSeconds
        self.note = note
        self.supersetGroup = supersetGroup
        self.nextTimeHint = nextTimeHint
    }
}
