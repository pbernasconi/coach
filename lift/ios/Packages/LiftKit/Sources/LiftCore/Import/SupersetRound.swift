import Foundation

/// One superset round on one line:
/// `lateral raise 12 @ 15 + curls 10 @ 25 + OH triceps 10 @ 45, 60s between rounds`.
struct SupersetRound: Equatable {
    var members: [SupersetMember]
    var restSeconds: Int?
    /// Trailing text after a comma that was not a rest instruction.
    var note: String?

    /// Nil unless the line has at least two `name reps [x|@ weight]` parts joined by `+`.
    static func parse(_ text: String) -> SupersetRound? {
        var parts = text.split(separator: "+").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 2, let last = parts.popLast() else { return nil }
        let tail = last.split(separator: ",", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
        parts.append(tail.first ?? last)
        var members: [SupersetMember] = []
        for part in parts {
            guard let member = member(part) else { return nil }
            members.append(member)
        }
        let trailing = tail.count > 1 ? tail[1] : ""
        let rest = NoteHintParser.restSeconds(in: trailing)
        return SupersetRound(members: members, restSeconds: rest, note: rest == nil ? SetLineParser.tidy(trailing) : nil)
    }

    /// The member names, normalized, to tell whether two rounds belong to the same superset.
    var keys: [String] { members.map { NameNormalizer.key($0.name) } }

    private static func member(_ part: String) -> SupersetMember? {
        guard let match = part.wholeMatch(of: /(?<name>.*?\p{L}.*?)\s+(?<set>\d.*)/),
            let set = SetLineParser.parse(String(match.output.set))
        else { return nil }
        return SupersetMember(name: String(match.output.name), set: set)
    }
}
