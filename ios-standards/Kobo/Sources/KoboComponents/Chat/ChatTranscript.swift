import KoboTokens
import SwiftUI

/// The scrolling list of a chat. It opens at the latest message and keeps following while new text arrives, as long
/// as the reader is at the end; once they scroll up to read, it stays put and a Jump to latest button appears. Rows sit
/// on the page column, newest at the bottom; the `footer` goes under the last row (a `TypingIndicator`, suggestions).
/// Dragging down dismisses the keyboard. Put the `ChatComposer` in a `.safeAreaBar(edge: .bottom)` on this view.
///
///     ChatTranscript(messages) { message in
///         switch message.role {
///         case .user: ChatBubble(verbatim: message.text)
///         case .assistant: ChatReply(markdown: message.text, isStreaming: message.isOpen)
///         }
///     } footer: {
///         if isWaiting { TypingIndicator() }
///     }
public struct ChatTranscript<Item: Identifiable, Row: View, Footer: View>: View {
    @State private var position = ScrollPosition(edge: .bottom)
    @State private var isAtEnd = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let items: [Item]
    private let row: (Item) -> Row
    private let footer: Footer

    public init(_ items: [Item], @ViewBuilder row: @escaping (Item) -> Row, @ViewBuilder footer: () -> Footer) {
        self.items = items
        self.row = row
        self.footer = footer()
    }

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.xl) {
                ForEach(items) { item in row(item) }
                footer
            }
            .padding(.vertical, Space.lg)
            .pageColumn()
        }
        .scrollPosition($position)
        .defaultScrollAnchor(.bottom, for: .initialOffset)
        .scrollDismissesKeyboard(.interactively)
        .onScrollGeometryChange(for: Bool.self) { geometry in
            ChatScrollMath.isAtEnd(
                contentHeight: geometry.contentSize.height + geometry.contentInsets.bottom,
                visibleMaxY: geometry.visibleRect.maxY + geometry.contentInsets.bottom
            )
        } action: { _, atEnd in
            isAtEnd = atEnd
        }
        .onScrollGeometryChange(for: CGFloat.self) {
            $0.contentSize.height
        } action: { old, new in
            // New text below the reader: follow it only when they were already at the end.
            if new > old && isAtEnd { position.scrollTo(edge: .bottom) }
        }
        .overlay(alignment: .bottom) {
            if !isAtEnd {
                IconButton("arrow.down", label: Text("Jump to latest", bundle: .module), style: .glass, size: .regular)
                {
                    withKoboAnimation(.defaultSpatial, reduceMotion: reduceMotion) { position.scrollTo(edge: .bottom) }
                }
                .padding(.bottom, Space.sm)
            }
        }
        .koboAnimation(.state, value: isAtEnd)
    }
}

extension ChatTranscript where Footer == EmptyView {
    /// A transcript with nothing under the last row.
    public init(_ items: [Item], @ViewBuilder row: @escaping (Item) -> Row) {
        self.init(items, row: row) { EmptyView() }
    }
}

#if DEBUG
    private struct SampleLine: Identifiable {
        let id: Int
        let fromReader: Bool
        let text: String
    }

    private struct ChatTranscriptPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var draft = ""
        private let lines = (0..<12).map { index in
            SampleLine(
                id: index,
                fromReader: index.isMultiple(of: 2),
                text: index.isMultiple(of: 2)
                    ? "Question \(index / 2 + 1): what about Sunday?"
                    : "Sunday works. The harbour is **quiet before ten**, so leave early."
            )
        }

        var body: some View {
            ChatTranscript(lines) { line in
                if line.fromReader {
                    ChatBubble(verbatim: line.text)
                } else {
                    ChatReply(markdown: line.text)
                }
            } footer: {
                TypingIndicator()
            }
            .background(theme.palette.canvas)
            .safeAreaBar(edge: .bottom) {
                ChatComposer(text: $draft, prompt: "Message", isResponding: true, onSend: {}, onStop: {})
                    .padding(.horizontal, Space.gutter)
                    .padding(.bottom, Space.sm)
            }
        }
    }

    #Preview("ChatTranscript") { ChatTranscriptPreview() }
    #Preview("ChatTranscript · dark") { ChatTranscriptPreview().preferredColorScheme(.dark) }
    #Preview("ChatTranscript · AX3") { ChatTranscriptPreview().dynamicTypeSize(.accessibility3) }
#endif
