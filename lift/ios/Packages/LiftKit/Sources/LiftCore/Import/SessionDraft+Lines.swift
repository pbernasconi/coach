import Foundation

/// How each kind of line inside a session changes the draft.
extension SessionDraft {
    /// Handles a `- [x]` / `- [ ]` line. Returns an issue kind when the line could not be placed.
    mutating func checklist(done: Bool, content: String, line: Int) -> ImportIssue.Kind? {
        if inWarmUp {
            warmUpLines.append(done ? content : "[ ] \(content)")
            return nil
        }
        if let round = SupersetRound.parse(content) {
            addRound(round, done: done, line: line, text: content)
            return nil
        }
        if let set = SetLineParser.parse(content) {
            return addSet(set, done: done, line: line) ? nil : .setWithoutExercise
        }
        if NoteHintParser.mentionsNextTime(content) || current != nil {
            addNote(content)
            return nil
        }
        return .setWithoutExercise
    }

    /// Handles a plain line: a superset round, a set without a checkbox, a hint, an equipment word for the
    /// header above, or a new exercise header. Returns an issue kind when none of those fit.
    mutating func text(_ content: String, line: Int) -> ImportIssue.Kind? {
        inWarmUp = false
        if let round = SupersetRound.parse(content) {
            addRound(round, done: true, line: line, text: content)
            return nil
        }
        let set = SetLineParser.parse(content)
        if let set, set.weightValue != nil || set.note == nil, addSet(set, done: true, line: line) {
            return nil
        }
        if NoteHintParser.mentionsNextTime(content) {
            addNote(content)
            return nil
        }
        if let current, exercises[current].sets.isEmpty, let equipment = EquipmentWord.equipment(for: content) {
            exercises[current].header.equipment = equipment
            return nil
        }
        if let header = ExerciseHeaderParser.parse(content) {
            startExercise(header, line: line, text: content)
            return nil
        }
        if let set { return addSet(set, done: true, line: line) ? nil : .setWithoutExercise }
        return .unrecognized
    }
}
