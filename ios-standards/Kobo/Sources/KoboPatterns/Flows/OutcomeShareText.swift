import Foundation

/// The words of an outcome's share sheet, one fact per line: the title, the status, each fact as "label: value", and
/// an optional closing line (a reference, a link). Every value is something the screen already shows, so sharing never
/// reveals more than the screen did.
///
///     OutcomeShareText.text(title: "Workout finished", status: "Completed", facts: facts)
nonisolated public enum OutcomeShareText {
    public static func text(title: String, status: String? = nil, facts: [OutcomeFact], footer: String? = nil)
        -> String
    {
        lines(title: title, status: status, facts: facts, footer: footer).joined(separator: "\n")
    }

    /// The lines, skipping empty parts so a missing status or footer never leaves a blank line.
    static func lines(title: String, status: String?, facts: [OutcomeFact], footer: String?) -> [String] {
        let rows = facts.filter { !$0.value.isEmpty }.map { "\($0.label): \($0.value)" }
        return ([title, status ?? ""] + rows + [footer ?? ""]).filter { !$0.isEmpty }
    }
}
