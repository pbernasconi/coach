import Foundation
import KoboComponents

/// The message the answers to Coach's question cards make (lift/APP-API.md, "Coach"): a line per question,
/// `title: answer`; several picks joined by ", ", a confirm's button label, and `skip` for Skip. Questions without an
/// answer are left out.
nonisolated enum CoachQuestionText {
    static func message(_ questions: [ChatQuestion], answers: [String: ChatAnswer]) -> String {
        questions.compactMap { question in
            answers[question.id].map { "\(question.title): \(text(for: $0))" }
        }
        .joined(separator: "\n")
    }

    static func text(for answer: ChatAnswer) -> String {
        switch answer {
        case .text(let text): text
        case .choices(let picked): picked.joined(separator: ", ")
        case .button(let label): label
        case .skipped: "skip"
        }
    }
}
