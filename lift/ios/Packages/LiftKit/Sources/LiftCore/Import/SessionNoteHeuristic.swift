import Foundation

/// Tells a free-text line in a workout ("Felt strong", "Short on time today") from an exercise header that lost its
/// sets ("Barbell", "Bench press"). Both reach the assembler as an exercise draft with no sets; a note goes to the
/// session's note, a header stays an `ImportIssue`.
///
/// A draft is a note when nothing in it reads as an exercise: no sets under it before the next exercise or session
/// boundary, no set, rep or load pattern on the line, no equipment word, no library exercise of that name, and no
/// movement word (press, squat, row…).
enum SessionNoteHeuristic {
    /// Words that name a movement (singular, as `NameNormalizer.tokens` leaves them); a line holding one stays an
    /// exercise header, sets or not.
    static let movementWords: Set<String> = [
        "press", "bench", "squat", "deadlift", "rdl", "row", "curl", "raise", "fly", "flye", "lunge", "pull",
        "pullup", "chin", "chinup", "dip", "pushup", "pulldown", "pushdown", "extension", "thrust", "bridge", "swing",
        "plank", "carry", "carrie", "shrug", "crunch", "crunche", "tricep", "bicep", "calf", "calve", "hip", "leg",
        "snatch", "clean", "jerk", "stepup", "situp", "rollout", "facepull", "goblet", "split", "hamstring", "glute",
        "lat", "ab", "abduction", "adduction", "kickback",
    ]

    /// True when `draft` reads as a note about the session rather than an exercise.
    static func isSessionNote(_ draft: ExerciseDraft, library: [Exercise]) -> Bool {
        let header = draft.header
        guard draft.sets.isEmpty else { return false }
        guard header.plannedSets == nil, header.reps == nil, header.repRange == nil, header.weightValue == nil,
            header.equipment == nil
        else { return false }
        let text = draft.text
        guard SetLineParser.parse(text) == nil, EquipmentWord.equipment(for: text) == nil,
            EquipmentWord.infer(fromName: text) == nil, ExerciseMatcher.match(name: header.name, in: library) == nil
        else { return false }
        return NameNormalizer.tokens(text).allSatisfy { !movementWords.contains($0) }
    }

    /// The draft's line, then any notes read under it, as session notes in reading order.
    static func notes(of draft: ExerciseDraft) -> [DraftNote] {
        ([draft.text] + draft.notes).map { DraftNote(line: draft.line, text: $0) }
    }
}
