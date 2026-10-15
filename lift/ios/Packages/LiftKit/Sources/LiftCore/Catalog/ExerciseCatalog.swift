import Foundation

/// The bundled exercise catalog: about 1,300 exercises with names, muscles, equipment and steps, plus where their
/// media lives. Immutable once loaded; load it off the main actor (`bundled()` parses about 1 MB of JSON).
public struct ExerciseCatalog: Sendable {
    /// The dataset commit the catalog (and every media path) is pinned to.
    public let commit: String
    /// The dataset's home page.
    public let source: String
    /// "MIT (data); media © Gym visual — https://gymvisual.com/, not included".
    public let license: String
    /// The credit to show with any of the media: "© Gym visual — https://gymvisual.com/".
    public let attribution: String
    /// Every exercise, ordered by id.
    public let entries: [CatalogExercise]
    /// Seed number → dataset id, as `scripts/import-exercise-dataset.py` copied it from `seed-map.json`.
    public let seeds: [String: String]
    /// Distinct body parts, sorted.
    public let bodyParts: [String]
    /// Distinct equipment, sorted.
    public let equipment: [String]
    /// Distinct target muscles, sorted.
    public let targets: [String]
    private let indexByID: [String: Int]
    let searchKeys: [CatalogSearchKey]

    public init(
        commit: String,
        source: String,
        license: String,
        attribution: String,
        entries: [CatalogExercise],
        seeds: [String: String] = [:]
    ) {
        self.commit = commit
        self.source = source
        self.license = license
        self.attribution = attribution
        self.entries = entries
        self.seeds = seeds
        bodyParts = Set(entries.map(\.bodyPart)).sorted()
        equipment = Set(entries.map(\.equipment)).sorted()
        targets = Set(entries.map(\.target)).sorted()
        indexByID = Dictionary(entries.enumerated().map { ($1.id, $0) }) { first, _ in first }
        searchKeys = entries.map(CatalogSearchKey.init)
    }

    /// Decodes the JSON that `scripts/import-exercise-dataset.py` writes.
    public init(json data: Data) throws {
        let file: CatalogFile
        do {
            file = try JSONDecoder().decode(CatalogFile.self, from: data)
        } catch {
            throw AppError(.decoding, detail: "exercise catalog")
        }
        self.init(
            commit: file.commit,
            source: file.source,
            license: file.license,
            attribution: file.attribution,
            entries: file.exercises,
            seeds: file.seeds
        )
    }

    /// The catalog bundled with LiftCore (`Resources/exercise-catalog.json`).
    public static func bundled() throws -> ExerciseCatalog {
        guard let url = Bundle.module.url(forResource: "exercise-catalog", withExtension: "json") else {
            throw AppError(.notFound, detail: "exercise-catalog.json")
        }
        return try ExerciseCatalog(json: Data(contentsOf: url))
    }

    /// Every distinct value of one facet, sorted.
    public func options(_ facet: CatalogFacet) -> [String] {
        switch facet {
        case .bodyPart: bodyParts
        case .target: targets
        case .equipment: equipment
        }
    }

    /// The exercise with dataset id `id`, if the catalog has it.
    public func entry(id: String) -> CatalogExercise? {
        indexByID[id].map { entries[$0] }
    }

    /// The catalog entry a seed exercise shows media and steps from.
    public func entry(forSeedExerciseID id: UUID) -> CatalogExercise? {
        CatalogSeedLinks.catalogID(forSeedExerciseID: id).flatMap(entry(id:))
    }
}

/// The file layout of `exercise-catalog.json`.
private struct CatalogFile: Decodable {
    let commit: String
    let source: String
    let license: String
    let attribution: String
    let seeds: [String: String]
    let exercises: [CatalogExercise]
}
