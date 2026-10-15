import Foundation

/// An exercise block as read, before matching and unit resolution.
struct ExerciseDraft: Equatable {
    let line: Int
    let text: String
    var header: ExerciseHeader
    var sets: [SetDraft] = []
    var notes: [String] = []
    var nextTimeHint: Weight?
    var restSeconds: Int?
    var supersetGroup: Int?

    init(line: Int, text: String, header: ExerciseHeader, supersetGroup: Int? = nil) {
        self.line = line
        self.text = text
        self.header = header
        self.supersetGroup = supersetGroup
    }

    /// Records a free-text note, and a next-time weight if it mentions one.
    mutating func addNote(_ note: String) {
        notes.append(note)
        if let hint = NoteHintParser.nextTimeWeight(in: note) {
            nextTimeHint = Weight(hint.value, hint.unit ?? header.unit ?? .lb)
        }
        if let rest = NoteHintParser.restSeconds(in: note) {
            restSeconds = rest
        }
    }

    mutating func addSet(_ parsed: ParsedSet, done: Bool, line: Int) {
        sets.append(SetDraft(line: line, done: done, parsed: parsed))
        if let note = parsed.note, NoteHintParser.mentionsNextTime(note),
            let hint = NoteHintParser.nextTimeWeight(in: note)
        {
            nextTimeHint = Weight(hint.value, hint.unit ?? parsed.unit ?? header.unit ?? .lb)
        }
    }
}
