import KoboTokens
import SwiftUI

/// A reply in a chat: full-width text on the canvas, not a bubble, so long answers read like a page. The text is
/// Markdown as models write it: paragraphs, "-" and "1." lists, "#" headings, and inline bold, italic, code and links.
/// While `isStreaming`, an unfinished `**` or `` ` `` is closed for now so it never flashes as raw marks, and VoiceOver
/// stays quiet; when the reply finishes it is spoken once. Cards and status rows go in the `footer` slot.
///
///     ChatReply(markdown: reply.text, isStreaming: reply.isOpen) {
///         if let changes = reply.changes { ChangeSetCard(…) }
///     }
public struct ChatReply<Footer: View>: View {
    private let markdown: String
    private let isStreaming: Bool
    private let footer: Footer

    public init(markdown: String, isStreaming: Bool = false, @ViewBuilder footer: () -> Footer) {
        self.markdown = markdown
        self.isStreaming = isStreaming
        self.footer = footer()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if !markdown.isEmpty {
                VStack(alignment: .leading, spacing: Space.sm) {
                    let text = isStreaming ? ChatMarkdown.closingOpenSpans(markdown) : markdown
                    ForEach(Array(ChatMarkdown.blocks(text).enumerated()), id: \.offset) { _, block in
                        ChatBlockView(block: block)
                    }
                }
                .textSelection(.enabled)
                .accessibilityElement(children: .combine)
            }
            footer
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onChange(of: isStreaming) { wasStreaming, streaming in
            if wasStreaming && !streaming { AccessibilityNotification.Announcement(markdown).post() }
        }
    }
}

extension ChatReply where Footer == EmptyView {
    /// A reply with no card under it.
    public init(markdown: String, isStreaming: Bool = false) {
        self.init(markdown: markdown, isStreaming: isStreaming) { EmptyView() }
    }
}

/// One block of a reply: a paragraph, a list item or a heading, its inline Markdown rendered.
private struct ChatBlockView: View {
    @Environment(\.koboTheme) private var theme
    let block: ChatTextBlock

    var body: some View {
        switch block {
        case .paragraph(let text):
            inline(text).font(theme.font(.body))
        case .heading(let text):
            inline(text).font(theme.font(.headline)).accessibilityAddTraits(.isHeader)
        case .bullet(let text):
            item(marker: "•", text)
        case .numbered(let number, let text):
            item(marker: "\(number).", text)
        }
    }

    private func item(marker: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Text(verbatim: marker).foregroundStyle(theme.palette.textSecondary).monospacedDigit()
            inline(text)
        }
        .font(theme.font(.body))
    }

    private func inline(_ text: String) -> some View {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        let attributed = (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
        return Text(attributed)
            .foregroundStyle(theme.palette.textPrimary)
            .tint(theme.palette.accentText)
            .fixedSize(horizontal: false, vertical: true)
    }
}

#if DEBUG
    private struct ChatReplyPreview: View {
        @Environment(\.koboTheme) private var theme
        var body: some View {
            VStack(spacing: Space.xxl) {
                ChatReply(
                    markdown: """
                        Sunday works. The museum is **closed on Mondays**, so:
                        - Leave at `09:00`
                        - Lunch near the harbour
                        1. Book the ferry
                        2. Pack light
                        """
                )
                ChatReply(markdown: "Checking the **weather for Sun", isStreaming: true)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("ChatReply") { ChatReplyPreview() }
    #Preview("ChatReply · dark") { ChatReplyPreview().preferredColorScheme(.dark) }
    #Preview("ChatReply · AX3") { ChatReplyPreview().dynamicTypeSize(.accessibility3) }
#endif
