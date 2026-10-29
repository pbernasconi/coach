import KoboTokens
import SwiftUI

/// One question an assistant asks, as a calm card: the title, a grey subtitle, then the way to answer it. A text
/// question has a grey field with a clear button and a round arrow (grey while empty). A single question's chips answer
/// on a tap; a multi question's chips toggle (picked ones turn grey with a check), "N selected" counts them and the
/// arrow submits. Either can offer "Add another…", which turns into a field. A confirm question has the filled primary
/// button, an outlined secondary one and an underlined Skip. Several questions: `ChatQuestions`.
///
///     ChatQuestionCard(question) { answer in reply(question, answer) }
public struct ChatQuestionCard: View {
    @Environment(\.koboTheme) private var theme
    @State private var text = ""
    private let question: ChatQuestion
    private let onAnswer: (ChatAnswer) -> Void

    public init(_ question: ChatQuestion, onAnswer: @escaping (ChatAnswer) -> Void) {
        self.question = question
        self.onAnswer = onAnswer
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if !question.title.isEmpty || question.subtitle != nil {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    if !question.title.isEmpty {
                        Text(verbatim: question.title)
                            .font(theme.font(.body).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                            .accessibilityAddTraits(.isHeader)
                    }
                    if let subtitle = question.subtitle {
                        Text(verbatim: subtitle)
                            .font(theme.font(.subheadline))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            answer
        }
        .chatCard()
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var answer: some View {
        switch question.kind {
        case .text(let placeholder):
            ChatQuestionField(
                text: $text,
                placeholder: placeholder ?? String(localized: "Type your answer", bundle: .module)
            ) {
                if let typed = ChatQuestionLogic.typed(text) { onAnswer(.text(typed)) }
            }
        case .single(let options, let allowsOther):
            ChatQuestionChoices(options: options, allowsOther: allowsOther, isMulti: false, onAnswer: onAnswer)
        case .multi(let options, let allowsOther):
            ChatQuestionChoices(options: options, allowsOther: allowsOther, isMulti: true, onAnswer: onAnswer)
        case .confirm(let primary, let secondary):
            VStack(spacing: Space.sm) {
                Button { onAnswer(.button(primary)) } label: { Text(verbatim: primary) }
                    .buttonStyle(.kobo(.primary, width: .full))
                if let secondary {
                    Button { onAnswer(.button(secondary)) } label: { Text(verbatim: secondary) }
                        .buttonStyle(.kobo(.outlined, width: .full))
                }
                Button { onAnswer(.skipped) } label: {
                    Text("Skip", bundle: .module)
                        .underline()
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// The chips of a single or multi question, with "Add another…" and, for multi, the count and the arrow.
private struct ChatQuestionChoices: View {
    @Environment(\.koboTheme) private var theme
    @State private var picked: [String] = []
    @State private var added: [String] = []
    @State private var isAdding = false
    @State private var typed = ""
    let options: [String]
    let allowsOther: Bool
    let isMulti: Bool
    let onAnswer: (ChatAnswer) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            FlowLayout(spacing: Space.sm, lineSpacing: Space.xs) {
                ForEach(Array((options + added).enumerated()), id: \.offset) { _, option in
                    ChatChoiceChip(title: option, isPicked: picked.contains(option)) { tap(option) }
                }
                if allowsOther, !isAdding {
                    ChatChoiceChip(
                        title: String(localized: "Add another…", bundle: .module),
                        systemImage: "pencil",
                        isPicked: false
                    ) { isAdding = true }
                }
            }
            if isAdding {
                ChatQuestionField(
                    text: $typed,
                    placeholder: String(localized: "Add another…", bundle: .module),
                    focusesAtOnce: true
                ) { addOther() }
            }
            if isMulti {
                HStack {
                    Text("\(picked.count) selected", bundle: .module)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                    Spacer(minLength: Space.sm)
                    ChatSubmitArrow(isEnabled: !picked.isEmpty) { onAnswer(.choices(picked)) }
                }
            }
        }
    }

    private func tap(_ option: String) {
        if isMulti {
            picked = ChatQuestionLogic.toggling(option, in: picked)
        } else {
            onAnswer(.choices([option]))
        }
    }

    private func addOther() {
        let all = options + added
        let typedOption = ChatQuestionLogic.typed(typed)
        if let option = ChatQuestionLogic.other(typed, options: all) {
            added.append(option)
        }
        typed = ""
        isAdding = false
        guard let typedOption else { return }
        if isMulti {
            if !picked.contains(typedOption) { picked.append(typedOption) }
        } else {
            onAnswer(.choices([typedOption]))
        }
    }
}
