import Foundation

/// A seed exercise's entry in the bundled catalog, for its media and dataset steps.
public struct CatalogSeedLink: Hashable, Sendable {
    /// The seed row number (`ExerciseLibrary.seedID(seed)`).
    public let seed: UInt8
    /// The dataset id.
    public let catalogID: String
    /// Set when the dataset only has a close variant ("barbell glute bridge on the floor" for Hip thrust).
    public let approximate: String?

    init(seed: UInt8, catalogID: String, approximate: String? = nil) {
        self.seed = seed
        self.catalogID = catalogID
        self.approximate = approximate
    }
}

/// Which catalog entry each seed exercise links to: `ExerciseMedia/seed-map.json` (chosen by eye from the dataset
/// thumbnails) as a Swift table, so the seed library never has to load the catalog. A test checks it against the
/// copy the import script writes into `exercise-catalog.json`.
public enum CatalogSeedLinks {
    /// One link per seed exercise, in seed order.
    public static let all: [CatalogSeedLink] = [
        CatalogSeedLink(seed: 1, catalogID: "0043"),  // Back squat
        CatalogSeedLink(seed: 2, catalogID: "0042"),  // Front squat
        CatalogSeedLink(seed: 3, catalogID: "0085"),  // Romanian deadlift
        CatalogSeedLink(seed: 4, catalogID: "0032"),  // Deadlift
        CatalogSeedLink(seed: 5, catalogID: "0025"),  // Bench press
        CatalogSeedLink(seed: 6, catalogID: "0289"),  // Dumbbell bench press
        CatalogSeedLink(seed: 7, catalogID: "0314"),  // Incline dumbbell press
        CatalogSeedLink(seed: 8, catalogID: "1456"),  // Overhead press
        CatalogSeedLink(seed: 9, catalogID: "0405"),  // Dumbbell shoulder press
        CatalogSeedLink(seed: 10, catalogID: "0027"),  // Barbell row
        CatalogSeedLink(seed: 11, catalogID: "0292"),  // Single-arm dumbbell row
        CatalogSeedLink(seed: 12, catalogID: "0327"),  // Chest-supported row
        CatalogSeedLink(seed: 13, catalogID: "0652"),  // Pull-up
        CatalogSeedLink(seed: 14, catalogID: "1326"),  // Chin-up
        CatalogSeedLink(seed: 15, catalogID: "0198"),  // Lat pulldown
        CatalogSeedLink(seed: 16, catalogID: "0180"),  // Seated cable row
        CatalogSeedLink(seed: 17, catalogID: "0410"),  // Bulgarian split squat
        CatalogSeedLink(seed: 18, catalogID: "0381"),  // Reverse lunge
        CatalogSeedLink(seed: 19, catalogID: "1463"),  // Leg press
        CatalogSeedLink(seed: 20, catalogID: "1409", approximate: "barbell glute bridge on the floor"),  // Hip thrust
        CatalogSeedLink(seed: 21, catalogID: "0549"),  // Kettlebell swing
        CatalogSeedLink(seed: 22, catalogID: "0605"),  // Calf raise
        CatalogSeedLink(seed: 23, catalogID: "0334"),  // Lateral raise
        CatalogSeedLink(seed: 24, catalogID: "0294"),  // Dumbbell curl
        CatalogSeedLink(seed: 25, catalogID: "0430"),  // Overhead triceps extension
        CatalogSeedLink(seed: 26, catalogID: "0203"),  // Face pull
        CatalogSeedLink(seed: 27, catalogID: "1757"),  // Single-leg deadlift
        CatalogSeedLink(seed: 28, catalogID: "1760"),  // Goblet squat
        CatalogSeedLink(seed: 29, catalogID: "2135", approximate: "weighted front plank"),  // Plank
        CatalogSeedLink(seed: 30, catalogID: "0431"),  // Step-up
    ]

    private static let bySeed: [UInt8: CatalogSeedLink] = Dictionary(all.map { ($0.seed, $0) }) { first, _ in first }

    /// The link for seed row `number`.
    public static func seedLink(seedNumber number: UInt8) -> CatalogSeedLink? {
        bySeed[number]
    }

    /// The catalog id of a seed exercise, or nil for any other id.
    public static func catalogID(forSeedExerciseID id: UUID) -> String? {
        let bytes = id.uuid
        guard ExerciseLibrary.seedID(bytes.15) == id else { return nil }
        return bySeed[bytes.15]?.catalogID
    }
}
