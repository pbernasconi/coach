import KoboTokens
import SwiftUI

/// Several questions an assistant asks, one card at a time (`ChatQuestionCard`). Above the card a small pager,
/// "‹ 1 of 5 ›", moves between them; answering one shows the next unanswered one. When every question has an answer,
/// `onFinish` gets them all at once, by question id, so the caller can send them as one message. One question shows no
/// pager.
///
///     ChatQuestions(reply.questions) { answers in send(text(for: answers)) }
public struct ChatQuestions: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var index = 0
    @State private var answers: [String: ChatAnswer] = [:]
    private let questions: [ChatQuestion]
    private let onFinish: ([String: ChatAnswer]) -> Void

    public init(_ questions: [ChatQuestion], onFinish: @escaping ([String: ChatAnswer]) -> Void) {
        self.questions = questions
        self.onFinish = onFinish
    }

    public var body: some View {
        if questions.indices.contains(index) {
            VStack(alignment: .leading, spacing: Space.xs) {
                if questions.count > 1 {
                    ChatQuestionPager(index: index, count: questions.count) { target in move(to: target) }
                }
                ChatQuestionCard(questions[index]) { answer($0) }
                    .id(questions[index].id)  // each question starts with its own field and picks
                    .transition(Motion.fade(reduceMotion: reduceMotion))
            }
        }
    }

    private func move(to target: Int) {
        withKoboAnimation(.state, reduceMotion: reduceMotion) { index = target }
    }

    private func answer(_ answer: ChatAnswer) {
        answers[questions[index].id] = answer
        let answered = questions.map { answers[$0.id] != nil }
        if let next = ChatQuestionLogic.next(after: index, answered: answered) {
            move(to: next)
        } else {
            onFinish(answers)
        }
    }
}

#if DEBUG
    private let sampleQuestions = [
        ChatQuestion(
            id: "when",
            title: "When suits you?",
            subtitle: "Thursday is free in the morning.",
            kind: .single(options: ["Thursday 09:00", "Friday 07:30"])
        ),
        ChatQuestion(
            id: "who",
            title: "Who should join?",
            kind: .multi(options: ["Design", "Support", "Sales"], allowsOther: true)
        ),
        ChatQuestion(id: "note", title: "Anything to add?", kind: .text(placeholder: "A note for the invite")),
        ChatQuestion(
            id: "send",
            title: "Send the invites now?",
            subtitle: "Everyone gets an email.",
            kind: .confirm(primary: "Send now", secondary: "Later today")
        ),
    ]

    private struct ChatQuestionsPreview: View {
        var body: some View {
            ScrollView {
                VStack(spacing: Space.xl) {
                    ChatQuestions(sampleQuestions) { _ in }
                    ChatQuestionCard(sampleQuestions[1]) { _ in }
                    ChatQuestionCard(sampleQuestions[2]) { _ in }
                    ChatQuestionCard(sampleQuestions[3]) { _ in }
                }
                .padding(Space.gutter)
            }
            .screenCanvas()
        }
    }

    #Preview("Questions") { ChatQuestionsPreview() }
    #Preview("Questions · dark") { ChatQuestionsPreview().preferredColorScheme(.dark) }
    #Preview("Questions · AX3") { ChatQuestionsPreview().dynamicTypeSize(.accessibility3) }
#endif
