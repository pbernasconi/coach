import Foundation

/// What to do next time, as a value. The UI turns it into words.
public enum ProgressionSuggestion: Hashable, Sendable {
    /// Every working set hit the top of the range: add one increment and restart at the bottom of the range.
    case increase(to: Weight, targetReps: Int)
    /// Keep the weight and aim for one more rep (clamped to the range).
    case repeatWeight(targetReps: Int)
    /// Reps fell below the range two sessions in a row: drop about 10%.
    case deload(to: Weight)
    /// No working sets to judge from.
    case noHistory
}
