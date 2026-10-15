import Foundation

/// A session as read, plus the parsing mode (warm-up, superset, current exercise) inside it.
struct SessionDraft: Equatable {
    /// The members of the superset round block being filled, so later rounds add to the same exercises.
    struct RoundBlock: Equatable {
        let group: Int
        let members: [Int]
        let keys: [String]
    }

    let line: Int
    let title: String
    let day: LocalDay
    /// Unchecked sets in a past session were skipped; in today's session they are still planned.
    let isPast: Bool
    var exercises: [ExerciseDraft] = []
    var warmUpLines: [String] = []
    var notes: [String] = []
    var current: Int?
    var round: RoundBlock?
    var supersetMode: Int?
    var lastGroup = 0
    var inWarmUp = false

    init(line: Int, title: String, day: LocalDay, isPast: Bool) {
        self.line = line
        self.title = title
        self.day = day
        self.isPast = isPast
    }

    /// A separator ends the current exercise, warm-up and superset.
    mutating func closeBlock() {
        current = nil
        round = nil
        supersetMode = nil
        inWarmUp = false
    }

    mutating func beginWarmUp(inline: String?) {
        closeBlock()
        inWarmUp = true
        if let inline { warmUpLines.append(inline) }
    }

    mutating func beginSuperset() {
        closeBlock()
        lastGroup += 1
        supersetMode = lastGroup
    }

    mutating func startExercise(_ header: ExerciseHeader, line: Int, text: String) {
        round = nil
        exercises.append(ExerciseDraft(line: line, text: text, header: header, supersetGroup: supersetMode))
        current = exercises.count - 1
    }

    /// Adds a set to the current exercise; false when there is none.
    mutating func addSet(_ parsed: ParsedSet, done: Bool, line: Int) -> Bool {
        guard let current else { return false }
        exercises[current].addSet(parsed, done: done, line: line)
        return true
    }

    /// Adds a note to the current exercise, or to the session when there is none.
    mutating func addNote(_ note: String) {
        if let current {
            exercises[current].addNote(note)
        } else {
            notes.append(note)
        }
    }

    /// Adds one set to each member, creating the members when the round starts a new superset.
    mutating func addRound(_ parsed: SupersetRound, done: Bool, line: Int, text: String) {
        let block =
            round.flatMap { $0.keys == parsed.keys ? $0 : nil } ?? startRoundBlock(parsed, line: line, text: text)
        for (index, member) in zip(block.members, parsed.members) {
            var set = member.set
            if index == block.members.first, let note = parsed.note {
                set.note = [set.note, note].compactMap(\.self).joined(separator: "; ")
            }
            exercises[index].addSet(set, done: done, line: line)
            if let rest = parsed.restSeconds { exercises[index].restSeconds = rest }
        }
        round = block
    }

    private mutating func startRoundBlock(_ parsed: SupersetRound, line: Int, text: String) -> RoundBlock {
        let group: Int
        if let mode = supersetMode, round == nil {
            group = mode
        } else {
            lastGroup += 1
            group = lastGroup
        }
        current = nil
        let first = exercises.count
        for member in parsed.members {
            exercises.append(
                ExerciseDraft(line: line, text: text, header: ExerciseHeader(name: member.name), supersetGroup: group)
            )
        }
        return RoundBlock(group: group, members: Array(first..<exercises.count), keys: parsed.keys)
    }
}
