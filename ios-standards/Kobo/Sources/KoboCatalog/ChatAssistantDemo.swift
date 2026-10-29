import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the assistant's parts of the Chat section: thought, feedback, questions, breakdown and the empty chat.
struct ChatAssistantDemo: View {
    @Environment(\.koboTheme) private var theme
    let component: CatalogComponent
    @State private var rating: ChatFeedbackRating?
    @State private var answered = ""

    var body: some View {
        switch component {
        case .chatThoughtRow:
            VStack(alignment: .leading, spacing: Space.md) {
                ChatThoughtRow(verbatim: "Thursday morning is free, and the trip starts on Friday.")
                ChatThoughtRow(verbatim: "A custom mark.") { ChatSparkle() }
            }
        case .chatFeedbackRow:
            ChatFeedbackRow(rating: rating, copying: "Moved the review to Thursday.") { rating = $0 }
        case .chatQuestionCard:
            ChatQuestionCard(ChatAssistantSamples.questions[1]) { answered = "\($0)" }
        case .chatQuestions:
            VStack(alignment: .leading, spacing: Space.md) {
                ChatQuestions(ChatAssistantSamples.questions) { answered = "\($0.count) answers" }
                Text(verbatim: answered).font(theme.font(.caption)).foregroundStyle(theme.palette.textSecondary)
            }
        case .chatBreakdownCard:
            ChatBreakdownCard(caption: "This week", total: "12 h 30 m", unit: "by project", rows: breakdown) {
                Button("Open") {}.buttonStyle(.kobo(.outlined, size: .compact, width: .full))
            }
        case .chatGreeting:
            ChatGreeting(verbatim: "Hi Sam,", "How can I help?")
        case .chatPromptCards:
            ChatPromptCards(ChatAssistantSamples.prompts) { answered = $0.title }
        case .chatGlow:
            ChatGlow().frame(height: Size.minTouch * 6)
        default: EmptyView()
        }
    }

    private var breakdown: [ChatBreakdownRow] {
        [
            ChatBreakdownRow(id: "a", label: "Design", value: 420, display: "7 h", tint: theme.palette.accent),
            ChatBreakdownRow(id: "b", label: "Writing", value: 210, display: "3 h 30 m", tint: theme.palette.info.ink),
            ChatBreakdownRow(id: "c", label: "Calls", value: 120, display: "2 h", tint: theme.palette.success.ink),
        ]
    }
}

/// Made-up content for the assistant demos.
private enum ChatAssistantSamples {
    static let questions = [
        ChatQuestion(id: "when", title: "When suits you?", kind: .single(options: ["Thursday 09:00", "Friday 07:30"])),
        ChatQuestion(
            id: "who",
            title: "Who should join?",
            kind: .multi(options: ["Design", "Support"], allowsOther: true)
        ),
        ChatQuestion(id: "note", title: "Anything to add?", kind: .text(placeholder: "A note for the invite")),
        ChatQuestion(
            id: "send",
            title: "Send the invites now?",
            kind: .confirm(primary: "Send now", secondary: "Later")
        ),
    ]

    static let prompts = [
        ChatPrompt(id: "a", title: "What's on my calendar tomorrow?", systemImage: "calendar"),
        ChatPrompt(id: "b", title: "Move the team review to Thursday", systemImage: "arrow.right"),
        ChatPrompt(id: "c", title: "Summarise last week"),
    ]
}
