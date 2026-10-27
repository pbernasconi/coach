import KoboTokens
import SwiftUI

/// The assistant's answer in a chat: full-width text with no bubble, as the system's own assistants show it. It reads
/// a small Markdown subset (`ChatReplyBlock`): paragraphs, headings, bullet and numbered lists, code blocks, and inline
/// bold, italics, links and code. Text is selectable. A reply that is still arriving can be shown as it grows; an open
/// code fence renders as code until it closes. While `isStreaming`, unclosed marks are closed (`ChatStreamingText`);
/// when it ends, VoiceOver announces the reply once. VoiceOver reads the whole reply as one element.
///
///     ChatReply(verbatim: "Moved **Team review** to Wednesday at 09:00.")
///     ChatReply(verbatim: partial, isStreaming: true)
public struct ChatReply: View {
    @Environment(\.koboTheme) private var theme
    private let blocks: [ChatReplyBlock]
    private let plain: String
    private let isStreaming: Bool

    /// A reply from its Markdown text; `isStreaming` while more of it is still arriving.
    public init(verbatim markdown: String, isStreaming: Bool = false) {
        blocks = ChatReplyBlock.parse(isStreaming ? ChatStreamingText.repaired(markdown) : markdown)
        plain = markdown
        self.isStreaming = isStreaming
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                blockView(block).padding(.top, Self.gap(before: index, in: blocks))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
        .accessibilityElement(children: .combine)
        .onChange(of: isStreaming) { was, now in
            if let text = ChatStreamingText.announcement(wasStreaming: was, isStreaming: now, text: plain) {
                AccessibilityNotification.Announcement(text).post()
            }
        }
        .contextMenu {
            Button {
                ChatPasteboard.copy(plain)
            } label: {
                Label {
                    Text("Copy", bundle: .module)
                } icon: {
                    Image(systemName: "doc.on.doc")
                }
            }
        }
    }

    @ViewBuilder
    private func blockView(_ block: ChatReplyBlock) -> some View {
        switch block {
        case .paragraph(let text):
            inline(text).font(theme.font(.body))
        case .heading(let text):
            inline(text).font(theme.font(.headline)).accessibilityAddTraits(.isHeader)
        case .listItem(let marker, let text):
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: marker).foregroundStyle(theme.palette.textSecondary).monospacedDigit()
                inline(text)
            }
            .font(theme.font(.body))
        case .code(let text):
            Text(verbatim: text)
                .font(theme.font(.footnote).monospaced())
                .foregroundStyle(theme.palette.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Space.md)
                .background(theme.palette.surfaceSunken, in: RoundedRectangle(cornerRadius: Radius.sm))
        }
    }

    /// Space above a block: none for the first, tight between list items, a paragraph gap otherwise.
    static func gap(before index: Int, in blocks: [ChatReplyBlock]) -> CGFloat {
        guard index > 0 else { return 0 }
        if case .listItem = blocks[index], case .listItem = blocks[index - 1] { return Space.xs }
        return Space.md
    }

    private func inline(_ text: String) -> some View {
        Text(Self.attributed(text))
            .lineSpacing(Space.xxs)
            .foregroundStyle(theme.palette.textPrimary)
            .tint(theme.palette.accentText)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Inline Markdown, or the text as it is when it does not parse (a reply cut in the middle of a mark).
    static func attributed(_ text: String) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
    }
}

#if DEBUG
    private let sampleReply = """
        Done. Here is the new plan for the trip:

        - **Friday:** train to the coast at 08:10
        - **Saturday:** the walk moves to the morning, before the rain
        1. Pack the day before
        2. Check the ferry times

        Tell me if you want the museum on *Sunday* instead.
        """

    private struct ChatReplyPreview: View {
        var body: some View {
            ScrollView {
                ChatReply(verbatim: sampleReply).padding(Space.gutter)
            }
            .screenCanvas()
        }
    }

    #Preview("Reply") { ChatReplyPreview() }
    #Preview("Reply · dark") { ChatReplyPreview().preferredColorScheme(.dark) }
    #Preview("Reply · AX3") { ChatReplyPreview().dynamicTypeSize(.accessibility3) }
#endif
