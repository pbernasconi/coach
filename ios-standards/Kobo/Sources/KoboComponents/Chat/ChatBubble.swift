import KoboTokens
import SwiftUI

/// The reader's own message in a chat: a trailing accent bubble. A message that did not send says so under the bubble
/// with a Try again button, so a failure never rests on colour alone. Replies use `ChatReply`, full width, not a bubble.
///
///     ChatBubble(verbatim: draft)
///     ChatBubble(verbatim: draft, delivery: .failed(retry: { resend(draft) }))
public struct ChatBubble: View {
    /// Whether the message reached the other side.
    public enum Delivery {
        case sent
        /// On its way: the bubble dims a little until it lands.
        case sending
        /// It did not send; `retry` sends it again.
        case failed(retry: () -> Void)
    }

    @Environment(\.koboTheme) private var theme
    private let text: Text
    private let delivery: Delivery

    /// A bubble with a localized message (samples and fixed copy).
    public init(_ text: LocalizedStringKey, delivery: Delivery = .sent) {
        self.text = Text(text)
        self.delivery = delivery
    }

    /// A bubble whose message is shown as is: what the reader typed.
    public init(verbatim text: String, delivery: Delivery = .sent) {
        self.text = Text(verbatim: text)
        self.delivery = delivery
    }

    public var body: some View {
        VStack(alignment: .trailing, spacing: Space.xs) {
            text
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.onAccent)
                .textSelection(.enabled)
                .padding(.horizontal, Space.md + Space.xxs)
                .padding(.vertical, Space.sm + Space.xxs)
                .background(theme.palette.accent, in: BubbleShape())
                .opacity(isSending ? ChatMetrics.sendingOpacity : 1)
                .koboAnimation(.state, value: isSending)
            if case .failed(let retry) = delivery {
                failure(retry)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.leading, ChatMetrics.bubbleLeadingInset)
        .accessibilityElement(children: .contain)
    }

    private var isSending: Bool {
        if case .sending = delivery { return true }
        return false
    }

    private func failure(_ retry: @escaping () -> Void) -> some View {
        HStack(spacing: Space.xs) {
            Image(systemName: "exclamationmark.circle.fill").accessibilityHidden(true)
            Text("Not sent", bundle: .module)
            Button(action: retry) { Text("Try again", bundle: .module).fontWeight(.semibold) }
                .buttonStyle(.plain)
                .frame(minHeight: Size.minTouch)
        }
        .font(theme.font(.footnote))
        .foregroundStyle(theme.palette.danger.ink)
    }
}

/// A rounded bubble with a tighter corner at the bottom trailing edge, pointing at its sender.
private struct BubbleShape: Shape {
    func path(in rect: CGRect) -> Path {
        UnevenRoundedRectangle(
            topLeadingRadius: Radius.lg,
            bottomLeadingRadius: Radius.lg,
            bottomTrailingRadius: Radius.xs,
            topTrailingRadius: Radius.lg,
            style: .continuous
        )
        .path(in: rect)
    }
}

#if DEBUG
    private struct ChatBubblePreview: View {
        @Environment(\.koboTheme) private var theme
        var body: some View {
            VStack(spacing: Space.lg) {
                ChatBubble("Can we move the trip to Sunday?")
                ChatBubble(verbatim: "Short one", delivery: .sending)
                ChatBubble(verbatim: "Book a table for four at eight, somewhere quiet.", delivery: .failed(retry: {}))
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("ChatBubble") { ChatBubblePreview() }
    #Preview("ChatBubble · dark") { ChatBubblePreview().preferredColorScheme(.dark) }
    #Preview("ChatBubble · AX3") { ChatBubblePreview().dynamicTypeSize(.accessibility3) }
#endif
