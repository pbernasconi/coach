import KoboTokens
import SwiftUI

/// Suggested replies under an assistant's answer: outlined chips that wrap, with no card around them. A tap hands the
/// chip's text to the caller, which usually sends it as the reader's message. For a real question with a title, use
/// `ChatQuestionCard`.
///
///     ChatQuickReplies(["Move it to Saturday", "Keep Friday"]) { send($0) }
public struct ChatQuickReplies: View {
    private let replies: [String]
    private let onSelect: (String) -> Void

    public init(_ replies: [String], onSelect: @escaping (String) -> Void) {
        self.replies = replies
        self.onSelect = onSelect
    }

    public var body: some View {
        FlowLayout(spacing: Space.sm, lineSpacing: Space.xs) {
            ForEach(Array(replies.enumerated()), id: \.offset) { _, reply in
                ChatChoiceChip(title: reply, isPicked: false) { onSelect(reply) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }
}

#if DEBUG
    private struct ChatQuickRepliesPreview: View {
        @State private var picked = ""

        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                ChatReply(verbatim: "Thursday is free in the morning. Move the review there?")
                ChatQuickReplies(["Move it to Thursday", "Keep it on Friday", "Skip it this week"]) { picked = $0 }
                Text(verbatim: picked)
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Quick replies") { ChatQuickRepliesPreview() }
    #Preview("Quick replies · dark") { ChatQuickRepliesPreview().preferredColorScheme(.dark) }
    #Preview("Quick replies · AX3") { ChatQuickRepliesPreview().dynamicTypeSize(.accessibility3) }
#endif
