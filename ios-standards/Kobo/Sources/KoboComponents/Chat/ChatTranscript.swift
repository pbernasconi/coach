import KoboTokens
import SwiftUI

/// The scrolling body of a chat: rows from the top, opening at the latest, with a footer after the last row (a typing
/// indicator, an error). It follows new rows and a reply that grows while the reader is at the bottom; a reader who
/// scrolls up stays put and gets a jump-to-latest button (`ChatScrollFollow`). Drag down to hide the keyboard. Put the
/// composer in `.safeAreaBar(edge: .bottom)` on it.
///
///     ChatTranscript(messages) { message in row(message) } footer: { if isWaiting { ChatTypingIndicator() } }
public struct ChatTranscript<Data: RandomAccessCollection, Row: View, Footer: View>: View
where Data.Element: Identifiable {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var position = ScrollPosition()
    @State private var follow = ChatScrollFollow()
    private let data: Data
    private let row: (Data.Element) -> Row
    private let footer: Footer

    public init(
        _ data: Data,
        @ViewBuilder row: @escaping (Data.Element) -> Row,
        @ViewBuilder footer: () -> Footer
    ) {
        self.data = data
        self.row = row
        self.footer = footer()
    }

    public var body: some View {
        ScrollView(.vertical) {
            // Not lazy: under a bottom anchor, iOS 26 shifts a lazy stack sideways (a thread stays short).
            VStack(alignment: .leading, spacing: Space.xxl) {
                ForEach(data) { row($0) }
                footer
            }
            .pageColumn()
            .padding(.vertical, Space.lg)
            // Exactly the scroll view's width: scrolling to the bottom edge must never shift the column sideways.
            .containerRelativeFrame(.horizontal)
            .scrollTargetLayout()
        }
        .scrollPosition($position)
        .defaultScrollAnchor(.bottomLeading)  // leading: a bottom anchor also centres the column sideways
        .scrollDismissesKeyboard(.interactively)
        .scrollEdgeEffectStyle(.soft, for: .bottom)
        // A little room under the last row; the jump button shows only half a screen up, so it never covers it.
        .contentMargins(.bottom, Space.lg, for: .scrollContent)
        .onScrollGeometryChange(for: [Double].self) { geometry in
            [
                ChatScrollFollow.distanceFromBottom(
                    contentHeight: geometry.contentSize.height,
                    offsetY: geometry.contentOffset.y,
                    visibleHeight: geometry.containerSize.height,
                    insetTop: geometry.contentInsets.top,
                    insetBottom: geometry.contentInsets.bottom
                ),
                geometry.containerSize.height,
            ]
        } action: { _, values in
            let distance = values[0]
            if position.isPositionedByUser || distance <= ChatScrollFollow.threshold {
                follow.scrolled(distanceFromBottom: distance, visibleHeight: values[1])
            }
        }
        .onScrollGeometryChange(for: Double.self) {
            $0.contentSize.height
        } action: { old, new in
            if new > old, follow.followsNewContent() { scrollToLatest(animated: false) }
        }
        .onChange(of: data.count) { old, new in
            if new > old, follow.followsNewContent() { scrollToLatest(animated: true) }
        }
        .overlay(alignment: .bottom) {
            if follow.showsJumpButton {
                IconButton("arrow.down", label: Text("Jump to latest", bundle: .module), style: .glass, size: .small) {
                    follow.jumped()
                    scrollToLatest(animated: true)
                }
                .padding(.bottom, Space.sm)
                .transition(Motion.pop(reduceMotion: reduceMotion))
            }
        }
        .koboAnimation(.defaultEffects, value: follow.showsJumpButton)
    }

    private func scrollToLatest(animated: Bool) {
        withKoboAnimation(.navigate, reduceMotion: reduceMotion || !animated) {
            position.scrollTo(edge: .bottom)
        }
    }
}

extension ChatTranscript where Footer == EmptyView {
    /// A transcript with no footer.
    public init(_ data: Data, @ViewBuilder row: @escaping (Data.Element) -> Row) {
        self.init(data, row: row) { EmptyView() }
    }
}

#if DEBUG
    private struct PreviewLine: Identifiable {
        let id: Int
        let mine: Bool
        let text: String
    }

    private struct ChatTranscriptPreview: View {
        @State private var draft = ""
        private let lines = (0..<12).map {
            PreviewLine(
                id: $0,
                mine: $0.isMultiple(of: 2),
                text: $0.isMultiple(of: 2) ? "Question \($0 / 2 + 1)?" : "An answer with **some detail** about it."
            )
        }

        var body: some View {
            ChatTranscript(lines) { line in
                if line.mine { ChatMessageBubble(verbatim: line.text) } else { ChatReply(verbatim: line.text) }
            } footer: {
                ChatTypingIndicator(verbatim: "Thinking")
            }
            .safeAreaBar(edge: .bottom) { ChatComposer(text: $draft, prompt: "Message", onSend: {}) }
            .screenCanvas()
        }
    }

    #Preview("Transcript") { ChatTranscriptPreview() }
    #Preview("Transcript · dark") { ChatTranscriptPreview().preferredColorScheme(.dark) }
    #Preview("Transcript · AX3") { ChatTranscriptPreview().dynamicTypeSize(.accessibility3) }
#endif
