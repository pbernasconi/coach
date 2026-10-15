import Foundation

/// Maps a written name to a library exercise. Only exact matches after normalization count; anything
/// weaker, or a tie between two exercises, returns nil rather than a guess.
public enum ExerciseMatcher {
    public static func match(name: String, in library: [Exercise]) -> ExerciseMatch? {
        let key = NameNormalizer.key(name)
        guard !key.isEmpty else { return nil }
        let live = library.filter { !$0.isArchived && $0.deletedAt == nil }
        if let found = unique(live.filter { NameNormalizer.key($0.name) == key }) {
            return ExerciseMatch(exercise: found, kind: .name)
        }
        if let found = unique(live.filter { $0.aliases.contains { NameNormalizer.key($0) == key } }) {
            return ExerciseMatch(exercise: found, kind: .alias)
        }
        let words = key.split(separator: " ").sorted()
        let reordered = live.filter { exercise in
            ([exercise.name] + exercise.aliases).contains { NameNormalizer.key($0).split(separator: " ").sorted() == words }
        }
        return unique(reordered).map { ExerciseMatch(exercise: $0, kind: .reorderedTokens) }
    }

    /// The normalized form used for matching, exposed so callers can group names the same way.
    public static func normalizedName(_ name: String) -> String {
        NameNormalizer.key(name)
    }

    private static func unique(_ candidates: [Exercise]) -> Exercise? {
        candidates.count == 1 ? candidates.first : nil
    }
}
