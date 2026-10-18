import Foundation

/// Where a linked exercise's library row comes from.
public enum LinkedExerciseSource: Hashable, Sendable {
    /// Already in the library.
    case library(Exercise)
    /// From the bundled catalog; adding it creates the library row (`ExerciseRepository.create(fromCatalog:)`).
    case catalog(CatalogExercise)
    /// A name neither knows: a new free-text library exercise.
    case new(name: String, equipment: Equipment, loadMode: LoadMode)

    /// The name the exercise will have in the library.
    public var name: String {
        switch self {
        case .library(let exercise): exercise.name
        case .catalog(let entry): entry.name
        case .new(let name, _, _): name
        }
    }

    /// Whether adding creates a library exercise.
    public var isNewToLibrary: Bool {
        if case .library = self { return false }
        return true
    }
}

/// Resolves a linked exercise name with the Notes importer's rules (`ExerciseMatcher`: case, accents, punctuation,
/// plurals and shorthand such as "db" ignored; then aliases; then the same words in another order; a tie is no
/// match): the library first, then the bundled catalog by name, else a new exercise.
public enum TemplateLinkResolver {
    public static func resolve(
        _ exercise: LinkedExercise,
        library: [Exercise],
        catalog: [CatalogExercise]
    ) -> LinkedExerciseSource {
        if let match = ExerciseMatcher.match(name: exercise.name, in: library) {
            return .library(match.exercise)
        }
        if let entry = catalogMatch(exercise.name, in: catalog) {
            // A library row already made from the entry (archived ones too) is reused, never duplicated.
            let linked = library.first { $0.catalogID == entry.id && $0.deletedAt == nil }
            return linked.map(LinkedExerciseSource.library) ?? .catalog(entry)
        }
        let equipment = equipment(for: exercise)
        return .new(name: exercise.name, equipment: equipment, loadMode: loadMode(for: exercise, equipment: equipment))
    }

    /// The one catalog entry whose name matches `name` exactly after normalizing, or with the same words reordered.
    static func catalogMatch(_ name: String, in catalog: [CatalogExercise]) -> CatalogExercise? {
        let key = NameNormalizer.key(name)
        guard !key.isEmpty else { return nil }
        let exact = catalog.filter { NameNormalizer.key($0.name) == key }
        if !exact.isEmpty { return exact.count == 1 ? exact.first : nil }
        let words = key.split(separator: " ").sorted()
        let reordered = catalog.filter { NameNormalizer.key($0.name).split(separator: " ").sorted() == words }
        return reordered.count == 1 ? reordered.first : nil
    }

    private static func equipment(for exercise: LinkedExercise) -> Equipment {
        if exercise.load == .bodyweight { return .bodyweight }
        return EquipmentWord.infer(fromName: exercise.name) ?? .other
    }

    /// The link's `load` when given; otherwise per hand for dumbbell work, bodyweight when the name says so, else
    /// the whole load.
    private static func loadMode(for exercise: LinkedExercise, equipment: Equipment) -> LoadMode {
        if let load = exercise.load { return load.loadMode }
        switch equipment {
        case .dumbbell: return .perHand
        case .bodyweight: return .bodyweight(added: nil)
        case .barbell, .kettlebell, .machine, .cable, .other: return .total
        }
    }
}
