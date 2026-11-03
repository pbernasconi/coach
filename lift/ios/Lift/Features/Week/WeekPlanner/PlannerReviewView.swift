import KoboComponents
import KoboTokens
import SwiftUI

/// Coach's reasoning under the draft: the headline, each decision with its why and tradeoff, what to watch, and the
/// plan checks that did not pass. Sections without text are left out.
struct PlannerReviewView: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let review = week.review {
                SectionHeader(verbatim: review.headline ?? String(localized: "Why this week"))
                ForEach(Array(review.reasoning.enumerated()), id: \.offset) { _, line in paragraph(line) }
                ForEach(Array(review.decisions.enumerated()), id: \.offset) { _, decision in
                    VStack(alignment: .leading, spacing: Space.xxs) {
                        Text(verbatim: decision.title)
                            .font(theme.font(.callout).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                        if let why = decision.why { paragraph(why) }
                        if let tradeoff = decision.tradeoff { paragraph(String(localized: "Tradeoff: \(tradeoff)")) }
                    }
                }
                if !review.watch.isEmpty {
                    InlineNotice(tone: .info, verbatimLines: review.watch)
                }
            } else if let summary = week.summary {
                SectionHeader("Why this week")
                paragraph(summary)
            }
            if !week.issues.isEmpty {
                InlineNotice(
                    tone: week.issues.contains { $0.level == "fail" } ? .danger : .warning,
                    verbatimLines: week.issues.map(\.message)
                )
            }
        }
    }

    private func paragraph(_ text: String) -> some View {
        Text(verbatim: text)
            .font(theme.font(.callout))
            .foregroundStyle(theme.palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Tell Coach what to change: quick asks as chips, then a box and Send. Coach redrafts and the change card shows what
/// moved.
struct PlannerAskView: View {
    let week: PlannerWeek
    let note: String
    let isWorking: Bool
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            SectionHeader("Ask Coach for a change")
            FlowLayout {
                ForEach(Array(week.quickAsks.enumerated()), id: \.offset) { _, ask in
                    Chip(verbatim: ask, isSelected: false) { send(.quickAskTapped(ask)) }
                        .disabled(isWorking)
                }
            }
            KoboTextArea(
                "Tell Coach what to change",
                text: .action(note) { send(.noteChanged($0)) },
                prompt: "Move the long ride to Sunday, I'm away Saturday",
                lines: 2...5,
                characterLimit: 500
            )
            Button("Send to Coach", systemImage: "paperplane.fill") { send(.noteSent) }
                .buttonStyle(.kobo(.secondary, width: .full))
                .disabled(isWorking || note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }
}
