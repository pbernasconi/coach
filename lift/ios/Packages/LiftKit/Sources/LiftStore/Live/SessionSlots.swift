import Foundation
import LiftCore

/// The template slots a session describes, for "Save as template".
enum SessionSlots {
    /// One slot per library exercise, in order; free-text exercises are left out. A slot takes the exercise's working
    /// sets (or all of its sets when none is a working set), the first one's rep target (else its reps, else 8–12)
    /// and load (planned, else saved or logged), and the exercise's rest.
    static func slots(of detail: SessionDetail, makeID: () -> UUID) -> [TemplateExercise] {
        detail.items.compactMap { item -> TemplateExercise? in
            guard let exerciseID = item.exercise.exerciseID, !item.sets.isEmpty else { return nil }
            let working = item.sets.filter { $0.kind == .working }
            let sets = working.isEmpty ? item.sets : working
            let first = sets[0]
            let reps = first.target.repRange ?? (first.target.reps ?? first.actualReps).map { max(1, $0)...max(1, $0) }
            return TemplateExercise(
                id: makeID(),
                exerciseID: exerciseID,
                displayName: item.exercise.displayName,
                sets: sets.count,
                repRange: reps ?? TemplateExercise.defaultRepRange,
                weight: first.target.weight ?? first.actualWeight,
                restSeconds: item.exercise.restSeconds,
                kind: working.isEmpty ? first.kind : .working
            )
        }
    }
}
