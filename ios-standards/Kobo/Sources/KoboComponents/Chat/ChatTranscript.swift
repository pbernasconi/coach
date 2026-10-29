import KoboTokens
import SwiftUI

/// The scrolling body of a chat: rows from the top, opening at the latest, with a footer after the last row (a typing
/// indicator, an error). It follows new rows and a reply that grows while the reader is at the bottom; a reader who
/// scrolls up stays put and gets a jump-to-latest button (`ChatScrollFollow`). Drag down to hide the keyboard. Put the
/// composer in `.safeAreaBar(edge: .bottom)` on it. `.timestamps { $0.sentAt }` adds quiet time lines between groups.
///
///     ChatTranscript(messages) { message in row(message) } footer: { if isWaiting { ChatTypingIndicator() } }
public struct ChatTranscript<Data: RandomAccessCollection, Row: View, Footer: View>: View
where Data.Element: Identifiable {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.calendar) private var calendar
    @Environment(\.timeZone) private var timeZone
    @State private var position = ScrollPosition()
    @State private var follow = ChatScrollFollow()
    /// The scroll view's height inside its bars and margins: the content fills at least this much.
    @State private var visibleHeight = 0.0
    private let data: Data
    private let row: (Data.Element) -> Row
    private let footer: Footer
    private var onTap: (() -> Void)?
    private var date: ((Data.Element) -> Date?)?

    public init(
        _ data: Data,
        @ViewBuilder row: @escaping (Data.Element) -> Row,
        @ViewBuilder footer: () -> Footer
    ) {
        self.data = data
        self.row = row
        self.footer = footer()
    }

    /// Runs `action` on any tap in the transcript, alongside the tapped control's own action: a screen uses it to
    /// close the keyboard. A drag down closes it too.
    public func onTranscriptTap(_ action: @escaping () -> Void) -> ChatTranscript {
        var transcript = self
        transcript.onTap = action
        return transcript
    }

    /// Puts a quiet time line ("Today 08:01", "Oct 26 at 11:33") above the first row and wherever an hour or more
    /// passed, or a day changed, since the row before (`ChatTimestampLogic`). A row without a date reads as now.
    public func timestamps(_ date: @escaping (Data.Element) -> Date?) -> ChatTranscript {
        var transcript = self
        transcript.date = date
        return transcript
    }

    public var body: some View {
        let now = Date.now
        let stamped = separators(now: now)
        return ScrollView(.vertical) {
            // Not lazy: under a bottom anchor, iOS 26 shifts a lazy stack sideways (a thread stays short).
            // swiftlint:disable:next accessibility_trait_for_button
            VStack(alignment: .leading, spacing: Space.xxl) {
                ForEach(Array(data.enumerated()), id: \.element.id) { offset, element in
                    if stamped.contains(offset), let date {
                        VStack(alignment: .leading, spacing: Space.lg) {
                            ChatTimestamp(date(element) ?? now, now: now)
                            row(element)
                        }
                    } else {
                        row(element)
                    }
                }
                footer
            }
            .pageColumn()
            .padding(.vertical, Space.lg)
            // At least the visible height, so a tap anywhere over the rows closes the keyboard; never the bars over
            // the scroll view (the composer), which get their own taps.
            .frame(minHeight: visibleHeight, alignment: .bottom)
            .contentShape(Rectangle())
            // The tap only closes the keyboard, beside each row's own controls: the transcript is not a button.
            .simultaneousGesture(TapGesture().onEnded { onTap?() })
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
                geometry.containerSize.height - geometry.contentInsets.top - geometry.contentInsets.bottom,
            ]
        } action: { _, values in
            let distance = values[0]
            let resized = abs(visibleHeight - max(0, values[2])) > 1
            visibleHeight = max(0, values[2])
            if resized {
                follow.resized()  // the keyboard moves the bottom: no jump button while it animates
            } else if position.isPositionedByUser || distance <= ChatScrollFollow.threshold {
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

    private func separators(now: Date) -> Set<Int> {
        guard let date else { return [] }
        var calendar = calendar
        calendar.timeZone = timeZone
        return ChatTimestampLogic.separators(data.map(date), now: now, calendar: calendar)
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
