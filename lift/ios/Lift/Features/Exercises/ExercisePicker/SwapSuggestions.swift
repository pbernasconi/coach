import Foundation
import LiftCore

extension ExercisePickerTarget {
    /// The session exercise a swap replaces and its library exercise; nil when the pick adds.
    var swapped: (sessionExerciseID: UUID, exerciseID: UUID?)? {
        if case .swap(let sessionExerciseID, let exerciseID) = self { return (sessionExerciseID, exerciseID) }
        return nil
    }
}

/// What to offer first when swapping an exercise: ones that train the same main muscles.
nonisolated enum SwapSuggestions {
    /// At most this many library suggestions.
    static let limit = 8

    /// The library exercises (other than `exercise`) sharing one of its main muscles, most shared first, then the same
    /// secondary muscles, then by name. Empty without an exercise or with no main muscles.
    static func library(_ exercises: [Exercise], like exercise: Exercise?) -> [Exercise] {
        guard let exercise, !exercise.primary.isEmpty else { return [] }
        let primary = Set(exercise.primary)
        let secondary = Set(exercise.secondary)
        let scored: [(score: Int, exercise: Exercise)] = exercises.compactMap { candidate in
            guard candidate.id != exercise.id else { return nil }
            let shared = primary.intersection(candidate.primary).count
            guard shared > 0 else { return nil }
            return (shared * 10 + secondary.intersection(candidate.secondary).count, candidate)
        }
        return
            scored
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.exercise.name.localizedStandardCompare(rhs.exercise.name) == .orderedAscending
            }
            .prefix(limit)
            .map(\.exercise)
    }

    /// `entries` with those sharing a main muscle with `exercise` first, each group in its own order. Unchanged
    /// without an exercise.
    static func catalog(_ entries: [CatalogExercise], like exercise: Exercise?) -> [CatalogExercise] {
        guard let exercise, !exercise.primary.isEmpty else { return entries }
        let primary = Set(exercise.primary)
        let similar = entries.filter { !primary.isDisjoint(with: $0.primaryMuscles) }
        guard !similar.isEmpty else { return entries }
        return similar + entries.filter { primary.isDisjoint(with: $0.primaryMuscles) }
    }
}
