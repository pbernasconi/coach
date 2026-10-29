import Foundation

/// A question an assistant asks as a card (`ChatQuestionCard`, `ChatQuestions`): a title, an optional subtitle, and
/// how it is answered.
nonisolated public struct ChatQuestion: Identifiable, Equatable, Sendable {
    /// How a question is answered.
    public enum Kind: Equatable, Sendable {
        /// Pick one option; a tap answers. `allowsOther` adds an "Add another…" chip to type one.
        case single(options: [String], allowsOther: Bool = false)
        /// Pick any options, then the arrow. `allowsOther` adds an "Add another…" chip to type one.
        case multi(options: [String], allowsOther: Bool = false)
        /// Type the answer in a field; `placeholder` is the hint in the empty field.
        case text(placeholder: String? = nil)
        /// A yes-or-no step: `primary` is the filled button, `secondary` the outlined one; Skip is always there.
        case confirm(primary: String, secondary: String? = nil)
    }

    public let id: String
    /// The question; empty for a card that shows only its choices (quick replies).
    public let title: String
    public let subtitle: String?
    public let kind: Kind

    public init(id: String, title: String, subtitle: String? = nil, kind: Kind) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.kind = kind
    }
}

/// The reader's answer to one `ChatQuestion`.
nonisolated public enum ChatAnswer: Equatable, Sendable {
    /// What was typed in a text question.
    case text(String)
    /// The options picked, in the order they were picked (one for a single question).
    case choices([String])
    /// The label of the confirm button tapped.
    case button(String)
    /// Skip on a confirm question.
    case skipped
}

/// The rules of the question cards: picking options, adding one of the reader's own, and moving through several.
nonisolated public enum ChatQuestionLogic {
    /// The selection after a tap on `option`: picked again, it leaves; otherwise it joins at the end.
    public static func toggling(_ option: String, in selection: [String]) -> [String] {
        selection.contains(option) ? selection.filter { $0 != option } : selection + [option]
    }

    /// The reader's own option, trimmed; nil when it is blank or already an option (then it is only picked).
    public static func other(_ typed: String, options: [String]) -> String? {
        let option = typed.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !option.isEmpty else { return nil }
        return options.contains(option) ? nil : option
    }

    /// The text typed, trimmed; nil while it is blank (the arrow stays grey).
    public static func typed(_ text: String) -> String? {
        let answer = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return answer.isEmpty ? nil : answer
    }

    /// The question to show after one is answered: the next unanswered one after `index`, then any unanswered one
    /// before it; nil when every question has an answer.
    public static func next(after index: Int, answered: [Bool]) -> Int? {
        let later = answered.indices.filter { $0 > index && !answered[$0] }
        let earlier = answered.indices.filter { $0 < index && !answered[$0] }
        return later.first ?? earlier.first
    }
}
