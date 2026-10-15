import Foundation
import LiftCore

/// Plain labels for the import flow. Numbers and plain words only (no generated commentary).
nonisolated enum ImportText {
    /// "1 workout", "3 workouts".
    static func workouts(_ count: Int) -> String {
        count == 1 ? String(localized: "1 workout") : String(localized: "\(count) workouts")
    }

    /// "1 set", "14 sets".
    static func sets(_ count: Int) -> String {
        count == 1 ? String(localized: "1 set") : String(localized: "\(count) sets")
    }

    /// "1 new exercise", "2 new exercises".
    static func newExercises(_ count: Int) -> String {
        count == 1 ? String(localized: "1 new exercise") : String(localized: "\(count) new exercises")
    }

    /// "1 line not imported", "3 lines not imported".
    static func linesNotImported(_ count: Int) -> String {
        count == 1 ? String(localized: "1 line not imported") : String(localized: "\(count) lines not imported")
    }

    /// The row under a workout: "5 exercises · 14 sets", with "Already imported" or the new exercise count.
    static func candidateDetail(_ candidate: ImportCandidate) -> String {
        var parts = [SessionText.exercises(candidate.exerciseCount), sets(candidate.setCount)]
        if candidate.isDuplicate {
            parts.append(String(localized: "Already imported"))
        } else if !candidate.newExerciseNames.isEmpty {
            parts.append(newExercises(candidate.newExerciseNames.count))
        }
        return parts.joined(separator: " · ")
    }

    /// "Line 4: Gym notebook (before the first workout title)".
    static func issue(_ issue: ImportIssue) -> String {
        String(localized: "Line \(issue.line): \(issue.text) (\(reason(issue.kind)))")
    }

    private static func reason(_ kind: ImportIssue.Kind) -> String {
        switch kind {
        case .outsideSession: String(localized: "before the first workout title")
        case .headerWithoutSets: String(localized: "an exercise with no sets")
        case .setWithoutExercise: String(localized: "a set with no exercise above it")
        case .invalidDate: String(localized: "no such date, so it uses today")
        case .unrecognized: String(localized: "not a set, exercise or note")
        }
    }

    /// The failure banner on the paste step.
    static func problem(_ problem: ImportProblem) -> String {
        switch problem {
        case .emptyText:
            String(localized: "Paste a workout note first.")
        case .clipboardEmpty:
            String(localized: "The clipboard has no text. Copy the note in Notes, then tap Paste.")
        case .nothingParsed:
            String(localized: "No workouts found. Each workout needs a title line with a date, like Workout A - Oct 6.")
        }
    }
}
