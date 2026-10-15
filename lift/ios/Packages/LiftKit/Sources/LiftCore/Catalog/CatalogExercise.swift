import Foundation

/// One exercise from the bundled catalog (the hasaneyldrm/exercises-dataset, English text only). Not a library row:
/// adding it to the library makes an `Exercise` whose `catalogID` is this `id`.
public struct CatalogExercise: Codable, Hashable, Sendable, Identifiable {
    /// The dataset id, four digits ("0043").
    public let id: String
    /// Title-cased name ("Barbell Full Squat").
    public let name: String
    public let category: String
    /// "upper legs", "chest", "back"…
    public let bodyPart: String
    /// "barbell", "body weight", "leverage machine"…
    public let equipment: String
    /// The main muscle: "quads", "pectorals", "lats"…
    public let target: String
    /// Other muscles worked: "hamstrings", "lower back"…
    public let secondary: [String]
    public let muscleGroup: String
    /// How to do one rep, in order.
    public let steps: [String]
    /// The still image's path inside the dataset ("images/0043-xxxx.jpg"). Media is never bundled.
    public let imagePath: String
    /// The animation's path inside the dataset ("videos/0043-xxxx.gif").
    public let gifPath: String

    public init(
        id: String,
        name: String,
        category: String,
        bodyPart: String,
        equipment: String,
        target: String,
        secondary: [String],
        muscleGroup: String,
        steps: [String],
        imagePath: String,
        gifPath: String
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.bodyPart = bodyPart
        self.equipment = equipment
        self.target = target
        self.secondary = secondary
        self.muscleGroup = muscleGroup
        self.steps = steps
        self.imagePath = imagePath
        self.gifPath = gifPath
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, category, bodyPart, equipment, target, secondary, muscleGroup, steps
        case imagePath = "image"
        case gifPath = "gif"
    }

    /// The dataset path of one kind of media for this exercise.
    public func mediaPath(_ kind: CatalogMediaKind) -> String {
        switch kind {
        case .still: imagePath
        case .animation: gifPath
        }
    }
}

/// The two kinds of media the dataset publishes for every exercise, both 180 × 180.
public enum CatalogMediaKind: Sendable, Hashable, CaseIterable {
    /// A JPEG still, for lists and for Reduce Motion.
    case still
    /// An animated GIF of one rep.
    case animation
}
